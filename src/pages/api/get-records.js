import { listRecords } from '../../lib/db';
import { requireAdmin } from '../../lib/auth';

/**
 * 受講記録取得 API（全件）
 * GET /api/get-records
 * 認証: 管理者トークン必須
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  try {
    const records = await listRecords({ includeAnswers: false });
    return res.status(200).json({ records });
  } catch (err) {
    console.error('get-records エラー:', err);
    return res.status(500).json({ error: '記録の取得に失敗しました。' });
  }
}
