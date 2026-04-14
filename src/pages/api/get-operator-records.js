import fs from 'fs';
import { getDataPath } from '../../lib/dataPath';

/**
 * 事業者別受講記録取得 API
 * GET /api/get-operator-records?operatorCode=A001
 *
 * 事業者管理画面用。自事業者の受講記録のみ返す。
 * passedOnly=true を付けると合格者のみ返す（修了証再発行用）
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { operatorCode, passedOnly } = req.query;

  if (!operatorCode) {
    return res.status(400).json({ error: 'operatorCode は必須です。' });
  }

  try {
    const filePath = getDataPath('records.json');
    if (!fs.existsSync(filePath)) {
      return res.status(200).json({ records: [] });
    }

    const records = JSON.parse(fs.readFileSync(filePath, 'utf-8') || '[]');
    const normalizedCode = operatorCode.trim().toUpperCase();

    let filtered = records.filter(
      (r) => (r.operatorCode || '').trim().toUpperCase() === normalizedCode
    );

    if (passedOnly === 'true') {
      filtered = filtered.filter((r) => r.passed);
    }

    // answers の詳細は除外
    const simplified = filtered.map(({ answers, ...rest }) => rest);

    return res.status(200).json({ records: simplified });
  } catch (err) {
    console.error('get-operator-records エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
