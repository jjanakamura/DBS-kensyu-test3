import fs from 'fs';
import { getDataPath } from '../../lib/dataPath';
import { writeAccessLog } from '../../lib/accessLog';

/**
 * 事業者管理画面ログイン API
 * POST /api/operator-login
 *
 * リクエスト: { operatorCode: string, password: string }
 * レスポンス:
 *   { success: true, operatorCode, companyName }  // 認証成功
 *   { success: false, message: string }            // 認証失敗
 *
 * ※ 試作版: パスワードは平文でoperators.jsonに保存。本番ではハッシュ化必須。
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { operatorCode, password } = req.body;

  if (!operatorCode || !password) {
    return res.status(400).json({ success: false, message: '事業者コードとパスワードを入力してください。' });
  }

  try {
    const filePath = getDataPath('operators.json');
    const operators = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    const normalizedCode = operatorCode.trim().toUpperCase();
    const operator = operators.find(
      (o) => o.operatorCode.trim().toUpperCase() === normalizedCode
    );

    if (!operator) {
      writeAccessLog({ type: 'operator', target: normalizedCode, result: 'fail', reason: 'コード不存在', req });
      return res.status(200).json({ success: false, message: '事業者コードが見つかりません。' });
    }

    if (operator.status === 'inactive') {
      writeAccessLog({ type: 'operator', target: normalizedCode, result: 'fail', reason: 'アカウント停止中', req });
      return res.status(200).json({ success: false, message: 'このアカウントは現在停止されています。事務局にお問い合わせください。' });
    }

    if (operator.adminPassword !== password) {
      writeAccessLog({ type: 'operator', target: normalizedCode, result: 'fail', reason: 'パスワード不正', req });
      return res.status(200).json({ success: false, message: 'パスワードが正しくありません。' });
    }

    writeAccessLog({ type: 'operator', target: normalizedCode, result: 'success', req });
    return res.status(200).json({
      success: true,
      operatorCode: operator.operatorCode,
      companyName: operator.companyName,
    });
  } catch (err) {
    console.error('operator-login エラー:', err);
    return res.status(500).json({ success: false, message: '内部エラーが発生しました。' });
  }
}
