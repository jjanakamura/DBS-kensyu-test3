import { getRecord } from '../../lib/db';
import { checkRateLimit } from '../../lib/rateLimit';

/**
 * 単一受講記録取得 API（修了証再発行用）
 * GET /api/get-record?id=REC-xxxxx
 *
 * セキュリティ:
 *   - ID は予測不能なランダムトークン
 *   - レート制限（IPあたり1分10回）
 *   - 合格記録のみ返却。answers は除外
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res, { key: 'get-record', limit: 10, windowMs: 60_000 })) return;

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'id は必須です。' });
  }
  if (!/^REC-[A-Za-z0-9_-]{8,80}$/.test(id)) {
    return res.status(400).json({ error: '不正なIDです。' });
  }

  try {
    const record = await getRecord(id);
    if (!record) return res.status(404).json({ error: '記録が見つかりません。' });
    if (!record.passed) return res.status(403).json({ error: '合格記録ではありません。' });

    const { answers, ...safe } = record;
    return res.status(200).json({ record: safe });
  } catch (err) {
    console.error('get-record エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
