import { listMembers } from '../../lib/db';
import { requireAdmin } from '../../lib/auth';

/**
 * 会員一覧取得 API（管理画面用・旧仕様の互換性のために維持）
 * GET /api/get-members
 * 認証: 管理者トークン必須
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  try {
    const members = await listMembers();
    return res.status(200).json({ members });
  } catch (err) {
    console.error('get-members エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
