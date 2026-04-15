import fs from 'fs';
import { getDataPath } from '../../lib/dataPath';
import { requireAdmin } from '../../lib/auth';

/**
 * 新規事業者登録 API（JJA管理画面用）
 * POST /api/add-operator
 * 認証: 管理者トークン必須
 *
 * リクエスト: { operatorCode, companyName, contactName, adminPassword }
 * レスポンス: { success: true, operator } | { error: string }
 *
 * - operators.json に事業者を追加
 * - classrooms.json に HQ 教室を自動作成
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    const opFilePath = getDataPath('operators.json');
    const clsFilePath = getDataPath('classrooms.json');

    let operators = [];
    if (fs.existsSync(opFilePath)) {
      operators = JSON.parse(fs.readFileSync(opFilePath, 'utf-8') || '[]');
    }

    // 重複チェック
    const exists = operators.find(
      (o) => o.operatorCode.trim().toUpperCase() === normalizedCode
    );
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

    operators.push(newOperator);
    fs.writeFileSync(opFilePath, JSON.stringify(operators, null, 2), 'utf-8');

    // HQ 教室を自動作成
    let classrooms = [];
    if (fs.existsSync(clsFilePath)) {
      classrooms = JSON.parse(fs.readFileSync(clsFilePath, 'utf-8') || '[]');
    }

    const hqEntry = {
      classroomCode: `${normalizedCode}-HQ`,
      operatorCode: normalizedCode,
      classroomName: '本部',
      classroomPassword: `${normalizedCode}-HQ`,
      isHQ: true,
      status: 'active',
      createdAt: today,
    };
    classrooms.push(hqEntry);
    fs.writeFileSync(clsFilePath, JSON.stringify(classrooms, null, 2), 'utf-8');

    const { adminPassword: _pw, ...safeOp } = newOperator;
    return res.status(200).json({ success: true, operator: safeOp });
  } catch (err) {
    console.error('add-operator エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
