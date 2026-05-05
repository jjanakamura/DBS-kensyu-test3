import { getOperator } from '../../lib/db';
import { writeAccessLog } from '../../lib/accessLog';
import { generateOperatorToken } from '../../lib/auth';
import { checkRateLimit } from '../../lib/rateLimit';

/**
 * 事業者管理画面ログイン API
 * POST /api/operator-login
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res, { key: 'operator-login', limit: 10, windowMs: 60_000 })) return;

  const { operatorCode, password } = req.body;
  if (!operatorCode || !password) {
    return res.status(400).json({ success: false, message: '事業者コードとパスワードを入力してください。' });
  }

  try {
    const op = await getOperator(operatorCode);
    const normalized = String(operatorCode).trim().toUpperCase();

    if (!op) {
      await writeAccessLog({ type: 'operator', target: normalized, result: 'fail', reason: 'コード不存在', req });
      return res.status(200).json({ success: false, message: '事業者コードが見つかりません。' });
    }
    if (op.status === 'inactive') {
      await writeAccessLog({ type: 'operator', target: normalized, result: 'fail', reason: 'アカウント停止中', req });
      return res.status(200).json({
        success: false,
        message: 'このアカウントは現在停止されています。事務局にお問い合わせください。',
      });
    }
    if (op.adminPassword !== password) {
      await writeAccessLog({ type: 'operator', target: normalized, result: 'fail', reason: 'パスワード不正', req });
      return res.status(200).json({ success: false, message: 'パスワードが正しくありません。' });
    }

    await writeAccessLog({ type: 'operator', target: normalized, result: 'success', req });
    return res.status(200).json({
      success: true,
      operatorCode: op.operatorCode,
      companyName: op.companyName,
      operatorToken: generateOperatorToken(op.adminPassword),
    });
  } catch (err) {
    console.error('operator-login エラー:', err);
    return res.status(500).json({ success: false, message: '内部エラーが発生しました。' });
  }
}
