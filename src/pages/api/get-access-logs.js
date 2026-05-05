import { listAccessLogs } from '../../lib/db';
import { requireAdmin } from '../../lib/auth';

/**
 * アクセスログ取得 API（管理画面専用）
 * GET /api/get-access-logs?limit=500
 * 認証: 管理者トークン必須
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  try {
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 1000);
    const logs = await listAccessLogs({ limit });
    return res.status(200).json({ logs });
  } catch (err) {
    console.error('get-access-logs error:', err);
    return res.status(500).json({ error: err.message });
  }
}
