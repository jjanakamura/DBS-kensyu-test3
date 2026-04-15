import fs from 'fs';
import { getDataPath } from '../../lib/dataPath';
import { getAuthScope } from '../../lib/auth';

/**
 * 受講者ステータス更新 API
 * POST /api/update-trainee-status
 * 認証: 管理者 / 事業者 / 教室トークン必須
 *
 * リクエスト: { id, status, notes }
 *   status: 'active' | 'retired' | 'suspended'
 *
 * 論理削除のみ。物理削除は行わない。
 * 受講記録（records.json）は一切変更しない。
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authScope = getAuthScope(req, res);
  if (!authScope) return;

  const { id, status, notes } = req.body;

  if (!id || !status) {
    return res.status(400).json({ error: 'id と status は必須です。' });
  }
  if (!['active', 'retired', 'suspended'].includes(status)) {
    return res.status(400).json({ error: '無効なステータスです。active / retired / suspended のいずれかを指定してください。' });
  }

  try {
    const filePath = getDataPath('trainees.json');
    let trainees = [];
    if (fs.existsSync(filePath)) {
      trainees = JSON.parse(fs.readFileSync(filePath, 'utf-8') || '[]');
    }

    const idx = trainees.findIndex((t) => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: '受講者が見つかりません。' });
    }

    const now = new Date().toISOString();
    const prev = trainees[idx];

    trainees[idx] = {
      ...prev,
      status,
      notes: notes !== undefined ? String(notes) : (prev.notes || ''),
      // 退職日：retired に変更した時のみセット。active に戻しても保持する（履歴として）
      retiredAt: status === 'retired' && !prev.retiredAt ? now : prev.retiredAt,
      statusUpdatedAt: now,
    };

    fs.writeFileSync(filePath, JSON.stringify(trainees, null, 2), 'utf-8');
    return res.status(200).json({ success: true, trainee: trainees[idx] });
  } catch (err) {
    console.error('trainees.json の書き込みエラー:', err);
    return res.status(500).json({ error: 'ステータスの更新に失敗しました。' });
  }
}
