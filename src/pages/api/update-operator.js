import { getOperator, updateOperator } from '../../lib/db';
import { requireAdmin } from '../../lib/auth';

/**
 * 事業者情報更新 API（JJA管理画面用）
 * POST /api/update-operator
 * 認証: 管理者トークン必須
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const { operatorCode, adminPassword, companyName, contactName, status } = req.body;
  if (!operatorCode) return res.status(400).json({ error: 'operatorCode は必須です。' });

  try {
    const op = await getOperator(operatorCode);
    if (!op) return res.status(404).json({ error: '事業者が見つかりません。' });

    const patch = {};
    if (adminPassword !== undefined && String(adminPassword).trim() !== '') {
      patch.adminPassword = String(adminPassword).trim();
    }
    if (companyName !== undefined && String(companyName).trim() !== '') {
      patch.companyName = String(companyName).trim();
    }
    if (contactName !== undefined) patch.contactName = String(contactName).trim();
    if (status !== undefined && ['active', 'inactive'].includes(status)) patch.status = status;

    const updated = await updateOperator(operatorCode, patch);
    const { adminPassword: _pw, ...safe } = updated;
    return res.status(200).json({ success: true, operator: safe });
  } catch (err) {
    console.error('update-operator エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
