import fs from 'fs';
import { getDataPath } from '../../lib/dataPath';

/**
 * 受講記録取得 API
 * GET /api/get-records
 *
 * レスポンス: { records: Array }
 *
 * ⚠ このエンドポイントは認証なしで全件返します
 * ⚠ 本番では適切な認証ミドルウェアを追加してください
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filePath = getDataPath('records.json');

    if (!fs.existsSync(filePath)) {
      return res.status(200).json({ records: [] });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const records = JSON.parse(raw || '[]');

    // answers の詳細は管理画面では不要なので除いてレスポンスサイズを削減
    const simplified = records.map(({ answers, ...rest }) => rest);

    return res.status(200).json({ records: simplified });
  } catch (err) {
    console.error('records.json の読み込みエラー:', err);
    return res.status(500).json({ error: '記録の取得に失敗しました。' });
  }
}
