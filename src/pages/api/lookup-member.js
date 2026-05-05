import { getMember } from '../../lib/db';
import { checkRateLimit } from '../../lib/rateLimit';

/**
 * 会員コード照合 API（旧仕様：会員コード受付）
 * POST /api/lookup-member
 *
 * リクエスト: { code: string }
 * レスポンス:
 *   { found: true, name: string }
 *   { found: false }
 *   { found: false, inactive: true }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res, { key: 'lookup-member', limit: 20, windowMs: 60_000 })) return;

  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'code は必須です。' });
  }

  try {
    const member = await getMember(code);
    if (!member) return res.status(200).json({ found: false });
    if (member.status === 'inactive') return res.status(200).json({ found: false, inactive: true });
    return res.status(200).json({ found: true, name: member.companyName });
  } catch (err) {
    console.error('lookup-member エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
