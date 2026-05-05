import crypto from 'crypto';
import {
  insertRecord,
  findClassroom,
  findTraineeByOperatorAndName,
  upsertTrainee,
} from '../../lib/db';
import { sanitizeName, sanitizeText } from '../../lib/sanitize';

/**
 * 受講記録保存 API
 * POST /api/submit-record
 *
 * セキュリティ:
 *   - 情報管理責任者研修（track=manager）は本部教室経由のみ保存可
 *   - 合格時は trainees に videoCompletedAt が記録されていることを確認
 *   - サーバー側で氏名等を再サニタイズ
 *
 * 変更点（Supabase化）:
 *   - 受講記録IDに16hex乱数を含めて予測不能化（前回と同じ仕様）
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const record = req.body;
  const codeField = record?.operatorCode || record?.memberCode;
  if (!record || !codeField || !record.fullName) {
    return res.status(400).json({ error: '必須フィールドが不足しています。' });
  }

  // サーバー側サニタイズ
  record.fullName = sanitizeName(record.fullName, 50);
  record.classroomName = sanitizeText(record.classroomName || '', 100);
  record.companyName = sanitizeText(record.companyName || '', 200);
  if (!record.fullName) {
    return res.status(400).json({ error: '氏名に使用できない文字が含まれています。' });
  }

  const opCode = String(codeField).trim().toUpperCase();
  const clsCode = String(record.classroomCode || '').trim().toUpperCase();

  // 情報管理責任者研修は本部教室のみ
  if (record.track === 'manager') {
    try {
      const cls = await findClassroom(opCode, clsCode, { activeOnly: false });
      if (!cls || !cls.isHQ) {
        return res.status(403).json({
          error: '情報管理責任者向け研修は、事業者本部からの受講のみ許可されています。',
        });
      }
    } catch {
      return res.status(500).json({ error: '教室情報の確認中にエラーが発生しました。' });
    }
  }

  // 合格時は動画視聴済みを確認
  if (record.passed) {
    try {
      const trainee = await findTraineeByOperatorAndName(opCode, record.fullName);
      if (!trainee || !trainee.videoCompletedAt) {
        return res.status(403).json({
          error: '動画視聴の記録が確認できませんでした。研修動画を最後まで視聴してから再度お試しください。',
        });
      }
    } catch {
      return res.status(500).json({ error: '視聴記録の確認中にエラーが発生しました。' });
    }
  }

  try {
    // 受講記録IDの生成（予測不能トークン付き）
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const randomToken = crypto.randomBytes(8).toString('hex');
    const seq = Date.now().toString().slice(-4);
    const newRecordId = `REC-${ymd}-${seq}-${randomToken}`;

    const recordRow = {
      id: newRecordId,
      operatorCode: opCode,
      memberCode: record.memberCode || null,
      classroomCode: clsCode,
      companyName: record.companyName || '',
      classroomName: record.classroomName || '',
      fullName: record.fullName,
      email: record.email || '',
      track: record.track === 'manager' ? 'manager' : 'general',
      score: record.score ?? null,
      correctCount: record.correctCount ?? null,
      totalQuestions: record.totalQuestions ?? null,
      passed: !!record.passed,
      failCount: record.failCount ?? 0,
      completionDate: record.completionDate || null,
      certNumber: record.certNumber || null,
      answers: record.answers || null,
      submittedAt: record.submittedAt || new Date().toISOString(),
    };

    await insertRecord(recordRow);

    // 受講者プロファイルのアップサート
    const existing = await findTraineeByOperatorAndName(opCode, record.fullName);
    const prevFailCount = Number(existing?.serverFailCount || 0);
    const newFailCount = recordRow.passed ? 0 : prevFailCount + 1;

    if (existing) {
      await upsertTrainee({
        ...existing,
        latestRecordId: newRecordId,
        classroomCode: clsCode || existing.classroomCode,
        classroomName: recordRow.classroomName || existing.classroomName,
        companyName: recordRow.companyName || existing.companyName,
        track: recordRow.track,
        serverFailCount: newFailCount,
        lastAttemptAt: new Date().toISOString(),
      });
    } else {
      const newTraineeId = `TRN-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      await upsertTrainee({
        id: newTraineeId,
        operatorCode: opCode,
        companyName: recordRow.companyName,
        classroomCode: clsCode,
        classroomName: recordRow.classroomName,
        fullName: recordRow.fullName,
        track: recordRow.track,
        status: 'active',
        retiredAt: null,
        statusUpdatedAt: null,
        notes: '',
        registeredAt: new Date().toISOString().slice(0, 10),
        latestRecordId: newRecordId,
        serverFailCount: newFailCount,
        lastAttemptAt: new Date().toISOString(),
      });
    }

    return res.status(200).json({ success: true, id: newRecordId, serverFailCount: newFailCount });
  } catch (err) {
    console.error('submit-record エラー:', err);
    return res.status(500).json({ error: '記録の保存に失敗しました。' });
  }
}
