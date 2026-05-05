import { getOperator, insertOperator, insertClassroom } from '../../lib/db';
import { requireAdmin } from '../../lib/auth';

/**
 * 新規事業者登録 API（JJA管理画面用）
 * POST /api/add-operator
 * 認証: 管理者トークン必須
 *
 * リクエスト: { operatorCode, companyName, contactName, adminPassword }
 * - 本部教室を自動作成
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const { operatorCode, companyName, contactName, adminPassword } = req.body;
  if (!operatorCode || !companyName || !adminPassword) {
    return res.status(400).json({ error: '事業者コード・会社名・パスワードは必須です。' });
  }
  const normalizedCode = String(operatorCode).trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(normalizedCode)) {
    return res.status(400).json({ error: '事業者コードは半角英数字2〜10文字で入力してください。' });
  }

  try {
    const exists = await getOperator(normalizedCode);
    if (exists) {
      return res.status(409).json({ error: `事業者コード "${normalizedCode}" はすでに登録されています。` });
    }

    const today = new Date().toISOString().slice(0, 10);
    const newOperator = {
      operatorCode: normalizedCode,
      companyName: String(companyName).trim(),
      adminPassword: String(adminPassword),
      contactName: String(contactName || '').trim(),
      contactEmail: '',
      status: 'active',
      registeredAt: today,
      note: '',
    };
    await insertOperator(newOperator);

    // 本部教室を自動作成
    await insertClassroom({
      classroomCode: `${normalizedCode}-HQ`,
      operatorCode: normalizedCode,
      classroomName: '本部',
      classroomPassword: `${normalizedCode}-HQ`,
      isHQ: true,
      status: 'active',
      createdAt: today,
    });

    const { adminPassword: _pw, ...safeOp } = newOperator;
    return res.status(200).json({ success: true, operator: safeOp });
  } catch (err) {
    console.error('add-operator エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
