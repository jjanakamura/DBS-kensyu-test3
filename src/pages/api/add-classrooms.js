import fs from 'fs';
import { getDataDir } from '../../lib/dataPath';

/**
 * 教室一括追加 API（CSV取込用）
 * POST /api/add-classrooms
 *
 * リクエスト: { operatorCode: string, classrooms: [{ classroomName: string }] }
 * レスポンス: { success: true, added: Classroom[], skipped: string[] }
 *
 * 教室コードは自動採番: {operatorCode}-C{01,02,...}
 * ※ HQコード（{operatorCode}-HQ）は本部専用として自動管理。CSVからは追加不可。
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { operatorCode, classrooms: newClassrooms } = req.body;

  if (!operatorCode || !Array.isArray(newClassrooms) || newClassrooms.length === 0) {
    return res.status(400).json({ error: 'operatorCode と classrooms（配列）は必須です。' });
  }

  try {
    const dataDir = getDataDir();
    const filePath = `${dataDir}/classrooms.json`;

    let classrooms = [];
    if (fs.existsSync(filePath)) {
      classrooms = JSON.parse(fs.readFileSync(filePath, 'utf-8') || '[]');
    }

    const normalizedOpCode = operatorCode.trim().toUpperCase();

    // 既存の C-番号の最大値を取得（HQは除く）
    const existing = classrooms.filter(
      (c) => c.operatorCode.trim().toUpperCase() === normalizedOpCode && !c.isHQ
    );
    let maxNum = 0;
    existing.forEach((c) => {
      const match = c.classroomCode.match(/-C(\d+)$/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    });

    const added = [];
    const skipped = [];
    const today = new Date().toISOString().slice(0, 10);

    newClassrooms.forEach((item) => {
      const name = (item.classroomName || '').trim();
      if (!name) { skipped.push('（空欄）'); return; }

      // 「本部」という名前はCSVから追加不可（HQで管理）
      if (name === '本部' || name === '本社' || name === '事務局') {
        skipped.push(`${name}（本部専用URLをご利用ください）`);
        return;
      }

      // 同一事業者に同名教室が既にある場合はスキップ
      const duplicate = classrooms.find(
        (c) =>
          c.operatorCode.trim().toUpperCase() === normalizedOpCode &&
          c.classroomName === name
      );
      if (duplicate) { skipped.push(name); return; }

      maxNum += 1;
      const classroomCode = `${normalizedOpCode}-C${String(maxNum).padStart(2, '0')}`;
      const newEntry = {
        classroomCode,
        operatorCode: normalizedOpCode,
        classroomName: name,
        status: 'active',
        createdAt: today,
      };
      classrooms.push(newEntry);
      added.push(newEntry);
    });

    fs.writeFileSync(filePath, JSON.stringify(classrooms, null, 2), 'utf-8');

    return res.status(200).json({ success: true, added, skipped });
  } catch (err) {
    console.error('add-classrooms エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
