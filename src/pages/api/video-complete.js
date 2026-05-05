import crypto from 'crypto';
import { findTraineeByOperatorAndName, upsertTrainee } from '../../lib/db';
import { sanitizeName, sanitizeText } from '../../lib/sanitize';
import { checkRateLimit } from '../../lib/rateLimit';

/**
 * 動画視聴完了通知 API
 * POST /api/video-complete
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res, { key: 'video-complete', limit: 30, windowMs: 60_000 })) return;

  const body = req.body || {};
  const operatorCode = String(body.operatorCode || '').trim().toUpperCase();
  const classroomCode = String(body.classroomCode || '').trim().toUpperCase();
  const fullName = sanitizeName(body.fullName || '', 50);
  const track = body.track === 'manager' ? 'manager' : 'general';
  const videoId = String(body.videoId || '').slice(0, 32);
  const watched = Number(body.watchedSeconds) || 0;
  const duration = Number(body.durationSeconds) || 0;

  if (!operatorCode || !fullName || !videoId) {
    return res.status(400).json({ error: '必須項目が不足しています。' });
  }
  if (duration > 0 && watched / duration < 0.95) {
    return res.status(400).json({ error: '視聴進捗が不足しています。' });
  }

  try {
    const existing = await findTraineeByOperatorAndName(operatorCode, fullName);
    const now = new Date().toISOString();

    if (existing) {
      await upsertTrainee({
        ...existing,
        videoCompletedAt: now,
        videoIdLastWatched: videoId,
        track: track || existing.track,
      });
    } else {
      const newId = `TRN-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      await upsertTrainee({
        id: newId,
        operatorCode,
        companyName: sanitizeText(body.companyName || '', 200),
        classroomCode,
        classroomName: sanitizeText(body.classroomName || '', 100),
        fullName,
        track,
        status: 'active',
        retiredAt: null,
        statusUpdatedAt: null,
        notes: '',
        registeredAt: new Date().toISOString().slice(0, 10),
        videoCompletedAt: now,
        videoIdLastWatched: videoId,
      });
    }
    return res.status(200).json({ success: true, videoCompletedAt: now });
  } catch (err) {
    console.error('video-complete エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
