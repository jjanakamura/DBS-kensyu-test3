import fs from 'fs';
import { getDataDir } from '../../lib/dataPath';

/**
 * 教室一覧取得 API
 * GET /api/get-classrooms?operatorCode=A001
 *
 * operatorCode を指定すると該当事業者の教室のみ返す
 * 未指定の場合は全教室を返す（JJA管理画面用）
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const dataDir = getDataDir();
    const classrooms = JSON.parse(fs.readFileSync(`${dataDir}/classrooms.json`, 'utf-8'));

    const { operatorCode } = req.query;

    let result = classrooms;
    if (operatorCode) {
      const code = operatorCode.trim().toUpperCase();
      result = classrooms.filter((c) => c.operatorCode.trim().toUpperCase() === code);
    }

    // 受講記録と紐付けて受講者数・合格者数を集計
    const filePath = `${dataDir}/records.json`;
    let records = [];
    if (fs.existsSync(filePath)) {
      records = JSON.parse(fs.readFileSync(filePath, 'utf-8') || '[]');
    }

    const enriched = result.map((c) => {
      const clsRecords = records.filter((r) => r.classroomCode === c.classroomCode);
      return {
        ...c,
        totalTrainees: clsRecords.length,
        passedTrainees: clsRecords.filter((r) => r.passed).length,
      };
    });

    return res.status(200).json({ classrooms: enriched });
  } catch (err) {
    console.error('get-classrooms エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
