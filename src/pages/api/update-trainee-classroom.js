import fs from 'fs';
import { getDataPath } from '../../lib/dataPath';

/**
 * 受講者の所属教室変更 API
 * POST /api/update-trainee-classroom
 *
 * リクエスト: { id, classroomCode, classroomName }
 * - 受講者プロファイル（trainees.json）の教室情報のみ更新
 * - 過去の受講記録（records.json）は変更しない（履歴保持）
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, classroomCode, classroomName } = req.body;

  if (!id || !classroomCode || !classroomName) {
    return res.status(400).json({ error: 'id, classroomCode, classroomName は必須です。' });
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

    trainees[idx] = {
      ...trainees[idx],
      classroomCode: String(classroomCode).trim(),
      classroomName: String(classroomName).trim(),
    };

    fs.writeFileSync(filePath, JSON.stringify(trainees, null, 2), 'utf-8');
    return res.status(200).json({ success: true, trainee: trainees[idx] });
  } catch (err) {
    console.error('trainees.json の書き込みエラー:', err);
    return res.status(500).json({ error: '教室変更に失敗しました。' });
  }
}
