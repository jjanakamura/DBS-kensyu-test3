import fs from 'fs';
import { getDataDir } from '../../lib/dataPath';

/**
 * 事業者コード・教室コード照合 API
 * POST /api/lookup-operator
 *
 * リクエスト: { operatorCode: string, classroomCode?: string }
 * レスポンス:
 *   { found: true, companyName, classroomName? }   // 有効
 *   { found: false, inactive: true }                // 停止中
 *   { found: false }                                // 存在しない
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { operatorCode, classroomCode } = req.body;

  if (!operatorCode || typeof operatorCode !== 'string') {
    return res.status(400).json({ error: 'operatorCode は必須です。' });
  }

  try {
    const dataDir = getDataDir();

    // 事業者照合
    const operators = JSON.parse(fs.readFileSync(`${dataDir}/operators.json`, 'utf-8'));
    const normalizedCode = operatorCode.trim().toUpperCase();
    const operator = operators.find(
      (o) => o.operatorCode.trim().toUpperCase() === normalizedCode
    );

    if (!operator) return res.status(200).json({ found: false });
    if (operator.status === 'inactive') return res.status(200).json({ found: false, inactive: true });

    // 教室コードが指定されている場合は追加照合
    let classroomName = null;
    if (classroomCode) {
      const classrooms = JSON.parse(fs.readFileSync(`${dataDir}/classrooms.json`, 'utf-8'));
      const normalizedCls = classroomCode.trim().toUpperCase();
      const classroom = classrooms.find(
        (c) =>
          c.classroomCode.trim().toUpperCase() === normalizedCls &&
          c.operatorCode.trim().toUpperCase() === normalizedCode &&
          c.status === 'active'
      );
      if (classroom) classroomName = classroom.classroomName;
    }

    return res.status(200).json({
      found: true,
      companyName: operator.companyName,
      classroomName,
    });
  } catch (err) {
    console.error('lookup-operator エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
