import fs from 'fs';
import { getDataPath } from '../../lib/dataPath';
import { requireAdmin } from '../../lib/auth';

/**
 * 事業者情報更新 API（JJA管理画面用）
 * POST /api/update-operator
 * 認証: 管理者トークン必須
 *
 * リクエスト: { operatorCode, adminPassword?, companyName?, contactName?, status? }
 * レスポンス: { success: true, operator } | { error: string }
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireAdmin(req, res)) return;

  const { operatorCode, adminPassword, companyName, contactName, status } = req.body;

  if (!operatorCode) {
    return res.status(400).json({ error: 'operatorCode は必須です。' });
  }

  try {
    const filePath = getDataPath('operators.json');
    let operators = JSON.parse(fs.readFileSync(filePath, 'utf-8') || '[]');

    const idx = operators.findIndex(
      (o) => o.operatorCode.trim().toUpperCase() === String(operatorCode).trim().toUpperCase()
    );
    if (idx === -1) {
      return res.status(404).json({ error: '事業者が見つかりません。' });
    }

    // 指定されたフィールドのみ更新
    if (adminPassword !== undefined && String(adminPassword).trim() !== '') {
      operators[idx].adminPassword = String(adminPassword).trim();
    }
    if (companyName !== undefined && String(companyName).trim() !== '') {
      operators[idx].companyName = String(companyName).trim();
    }
    if (contactName !== undefined) {
      operators[idx].contactName = String(contactName).trim();
    }
    if (status !== undefined && ['active', 'inactive'].includes(status)) {
      operators[idx].status = status;
    }

    fs.writeFileSync(filePath, JSON.stringify(operators, null, 2), 'utf-8');

    const { adminPassword: _pw, ...safe } = operators[idx];
    return res.status(200).json({ success: true, operator: safe });
  } catch (err) {
    console.error('update-operator エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
