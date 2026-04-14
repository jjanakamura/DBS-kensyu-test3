import fs from 'fs';
import { getDataPath } from '../../lib/dataPath';

/**
 * 教室パスワード更新 API
 * POST /api/update-classroom-password
 *
 * リクエスト: { classroomCode, classroomPassword }
 * レスポンス: { success: true } | { error: string }
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { classroomCode, classroomPassword } = req.body;

  if (!classroomCode || !classroomPassword) {
    return res.status(400).json({ error: 'classroomCode と classroomPassword は必須です。' });
  }
  if (String(classroomPassword).trim().length < 1) {
    return res.status(400).json({ error: 'パスワードを入力してください。' });
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

    classrooms[idx].classroomPassword = String(classroomPassword).trim();
    fs.writeFileSync(filePath, JSON.stringify(classrooms, null, 2), 'utf-8');

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('update-classroom-password エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
