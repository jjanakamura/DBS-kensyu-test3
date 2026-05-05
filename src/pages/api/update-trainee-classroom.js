import { getTrainee, updateTrainee } from '../../lib/db';
import { getAuthScope } from '../../lib/auth';

/**
 * 受講者の所属教室変更 API
 * POST /api/update-trainee-classroom
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authScope = await getAuthScope(req, res);
  if (!authScope) return;

  const { id, classroomCode, classroomName } = req.body;
  if (!id || !classroomCode || !classroomName) {
    return res.status(400).json({ error: 'id, classroomCode, classroomName は必須です。' });
  }

  try {
    const prev = await getTrainee(id);
    if (!prev) return res.status(404).json({ error: '受講者が見つかりません。' });
    if (authScope.scope !== 'admin' && prev.operatorCode !== authScope.operatorCode) {
      return res.status(403).json({ error: 'このデータへのアクセス権がありません。' });
    }
    const updated = await updateTrainee(id, {
      classroomCode: String(classroomCode).trim().toUpperCase(),
      classroomName: String(classroomName).trim(),
    });
    return res.status(200).json({ success: true, trainee: updated });
  } catch (err) {
    console.error('update-trainee-classroom エラー:', err);
    return res.status(500).json({ error: '教室変更に失敗しました。' });
  }
}
