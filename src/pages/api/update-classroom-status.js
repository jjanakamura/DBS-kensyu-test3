import fs from 'fs';
import { getDataPath } from '../../lib/dataPath';
import { getAuthScope } from '../../lib/auth';

/**
 * 教室ステータス更新 API
 * POST /api/update-classroom-status
 * 認証: 管理者 / 事業者 / 教室トークン必須
 *
 * リクエスト: { classroomCode, status }  status: 'active' | 'inactive'
 * レスポンス: { success: true } | { error: string }
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authScope = getAuthScope(req, res);
  if (!authScope) return;

  const { classroomCode, status } = req.body;

  if (!classroomCode || !status) {
    return res.status(400).json({ error: 'classroomCode と status は必須です。' });
  }
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'status は active または inactive のみ使用できます。' });
  }

  try {
    const filePath = getDataPath('classrooms.json');
    let classrooms = JSON.parse(fs.readFileSync(filePath, 'utf-8') || '[]');

    const idx = classrooms.findIndex(
      (c) => c.classroomCode.trim().toUpperCase() === String(classroomCode).trim().toUpperCase()
    );
    if (idx === -1) {
      return res.status(404).json({ error: '教室が見つかりません。' });
    }

    classrooms[idx].status = status;
    fs.writeFileSync(filePath, JSON.stringify(classrooms, null, 2), 'utf-8');

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('update-classroom-status エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
