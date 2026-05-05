import { getClassroom, updateClassroom } from '../../lib/db';
import { getAuthScope } from '../../lib/auth';

/**
 * 教室ステータス更新 API
 * POST /api/update-classroom-status
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authScope = await getAuthScope(req, res);
  if (!authScope) return;

  const { classroomCode, status } = req.body;
  if (!classroomCode || !status) {
    return res.status(400).json({ error: 'classroomCode と status は必須です。' });
  }
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'status は active または inactive のみ使用できます。' });
  }

  try {
    const cls = await getClassroom(classroomCode);
    if (!cls) return res.status(404).json({ error: '教室が見つかりません。' });
    if (authScope.scope !== 'admin' && cls.operatorCode !== authScope.operatorCode) {
      return res.status(403).json({ error: 'このデータへのアクセス権がありません。' });
    }
    await updateClassroom(classroomCode, { status });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('update-classroom-status エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
