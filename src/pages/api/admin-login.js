import { writeAccessLog } from '../../lib/accessLog';
import { generateAdminToken } from '../../lib/auth';
import { checkRateLimit } from '../../lib/rateLimit';

/**
 * 管理者ログイン API
 * POST /api/admin-login
 *
 * パスワードは環境変数 ADMIN_PASSWORD で管理（ソースコードに書かない）
 * Vercel 管理画面 → Settings → Environment Variables → ADMIN_PASSWORD を設定すること
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res, { key: 'admin-login', limit: 5, windowMs: 60_000 })) return;

  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ success: false, message: 'パスワードを入力してください。' });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('[admin-login] ADMIN_PASSWORD が未設定です。');
    await writeAccessLog({ type: 'admin', target: 'ADMIN', result: 'fail', reason: 'ADMIN_PASSWORD未設定', req });
    return res.status(503).json({
      success: false,
      message: 'システム設定が不完全です。管理者へお問い合わせください。',
    });
  }

  if (password === adminPassword) {
    await writeAccessLog({ type: 'admin', target: 'ADMIN', result: 'success', req });
    return res.status(200).json({ success: true, adminToken: generateAdminToken() });
  } else {
    await writeAccessLog({ type: 'admin', target: 'ADMIN', result: 'fail', reason: 'パスワード不正', req });
    return res.status(200).json({ success: false, message: 'パスワードが正しくありません。' });
  }
}
