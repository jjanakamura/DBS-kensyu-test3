import { writeAccessLog } from '../../lib/accessLog';
import { generateAdminToken } from '../../lib/auth';

/**
 * 管理者ログイン API
 * POST /api/admin-login
 *
 * パスワードは環境変数 ADMIN_PASSWORD で管理（ソースコードに書かない）
 * Vercel 管理画面 → Settings → Environment Variables → ADMIN_PASSWORD を設定すること
 *
 * リクエスト : { password: string }
 * レスポンス : { success: true } | { success: false, message: string }
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};

  if (!password) {
    return res.status(400).json({ success: false, message: 'パスワードを入力してください。' });
  }

  // 環境変数からパスワードを取得（未設定時は開発用フォールバック）
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.warn('[admin-login] ADMIN_PASSWORD 環境変数が設定されていません。本番環境では必ず設定してください。');
  }
  const expected = adminPassword || 'admin2024';

  if (password === expected) {
    writeAccessLog({ type: 'admin', target: 'ADMIN', result: 'success', req });
    return res.status(200).json({ success: true, adminToken: generateAdminToken() });
  } else {
    writeAccessLog({ type: 'admin', target: 'ADMIN', result: 'fail', reason: 'パスワード不正', req });
    return res.status(200).json({ success: false, message: 'パスワードが正しくありません。' });
  }
}
