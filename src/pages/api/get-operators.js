import fs from 'fs';
import { getDataDir } from '../../lib/dataPath';

/**
 * 事業者一覧取得 API（JJA管理画面用）
 * GET /api/get-operators
 *
 * adminPassword は除いて返す（セキュリティ）
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const dataDir = getDataDir();
    const operators = JSON.parse(fs.readFileSync(`${dataDir}/operators.json`, 'utf-8'));

    // パスワードを除いて返す
    const safe = operators.map(({ adminPassword, ...rest }) => rest);

    // 教室数・受講者数を集計
    let classrooms = [];
    const clsPath = `${dataDir}/classrooms.json`;
    if (fs.existsSync(clsPath)) {
      classrooms = JSON.parse(fs.readFileSync(clsPath, 'utf-8') || '[]');
    }

    let records = [];
    const recPath = `${dataDir}/records.json`;
    if (fs.existsSync(recPath)) {
      records = JSON.parse(fs.readFileSync(recPath, 'utf-8') || '[]');
    }

    const enriched = safe.map((op) => {
      const opClassrooms = classrooms.filter((c) => c.operatorCode === op.operatorCode);
      const opRecords = records.filter((r) => r.operatorCode === op.operatorCode);
      return {
        ...op,
        classroomCount: opClassrooms.length,
        traineeCount: opRecords.length,
        passedCount: opRecords.filter((r) => r.passed).length,
      };
    });

    return res.status(200).json({ operators: enriched });
  } catch (err) {
    console.error('get-operators エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
