import { getClassroom, updateClassroom } from '../../lib/db';
import { getAuthScope } from '../../lib/auth';

/**
 * 教室パスワード更新 API
 * POST /api/update-classroom-password
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authScope = await getAuthScope(req, res);
  if (!authScope) return;

  const { classroomCode, classroomPassword } = req.body;
  if (!classroomCode || !classroomPassword) {
    return res.status(400).json({ error: 'classroomCode と classroomPassword は必須です。' });
  }
  if (String(classroomPassword).trim().length < 1) {
    return res.status(400).json({ error: 'パスワードを入力してください。' });
  }

  try {
    const cls = await getClassroom(classroomCode);
    if (!cls) return res.status(404).json({ error: '教室が見つかりません。' });
    if (authScope.scope !== 'admin' && cls.operatorCode !== authScope.operatorCode) {
      return res.status(403).json({ error: 'このデータへのアクセス権がありません。' });
    }
    await updateClassroom(classroomCode, { classroomPassword: String(classroomPassword).trim() });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('update-classroom-password エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
