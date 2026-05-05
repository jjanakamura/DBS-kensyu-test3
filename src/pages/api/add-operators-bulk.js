import { listOperators, insertOperator, insertClassroom } from '../../lib/db';
import { requireAdmin } from '../../lib/auth';
import { sanitizeText } from '../../lib/sanitize';

/**
 * 事業者の一括登録 API（CSV取込）
 * POST /api/add-operators-bulk
 * 認証: 管理者トークン必須
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const { operators: input } = req.body || {};
  if (!Array.isArray(input) || input.length === 0) {
    return res.status(400).json({ error: '事業者データが空です。' });
  }
  if (input.length > 500) {
    return res.status(400).json({ error: '一度に登録できるのは500件までです。' });
  }

  try {
    const existing = await listOperators({ includePasswords: false });
    const existingCodes = new Set(existing.map((o) => o.operatorCode));
    const today = new Date().toISOString().slice(0, 10);
    const added = [];
    const skipped = [];
    const seenInBatch = new Set();

    for (const row of input) {
      const operatorCode = String(row.operatorCode || '').trim().toUpperCase();
      const companyName = sanitizeText(row.companyName || '', 200);
      const contactName = sanitizeText(row.contactName || '', 100);
      const adminPassword = String(row.adminPassword || '').trim();

      if (!operatorCode) { skipped.push({ operatorCode: '(空欄)', reason: '事業者コードが空です' }); continue; }
      if (!/^[A-Z0-9]{2,10}$/.test(operatorCode)) { skipped.push({ operatorCode, reason: '事業者コードは半角英数字2〜10文字' }); continue; }
      if (!companyName) { skipped.push({ operatorCode, reason: '会社名が空です' }); continue; }
      if (!adminPassword) { skipped.push({ operatorCode, reason: 'パスワードが空です' }); continue; }
      if (existingCodes.has(operatorCode)) { skipped.push({ operatorCode, reason: '既に登録されています' }); continue; }
      if (seenInBatch.has(operatorCode)) { skipped.push({ operatorCode, reason: 'CSV内に重複しています' }); continue; }
      seenInBatch.add(operatorCode);
      existingCodes.add(operatorCode);

      try {
        await insertOperator({
          operatorCode,
          companyName,
          adminPassword,
          contactName,
          contactEmail: '',
          status: 'active',
          registeredAt: today,
          note: '',
        });
        await insertClassroom({
          classroomCode: `${operatorCode}-HQ`,
          operatorCode,
          classroomName: '本部',
          classroomPassword: `${operatorCode}-HQ`,
          isHQ: true,
          status: 'active',
          createdAt: today,
        });
        added.push({ operatorCode, companyName, contactName });
      } catch (e) {
        skipped.push({ operatorCode, reason: 'DBエラー: ' + (e.message || '不明') });
      }
    }

    return res.status(200).json({
      success: true,
      added,
      skipped,
      addedCount: added.length,
      skippedCount: skipped.length,
    });
  } catch (err) {
    console.error('add-operators-bulk エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
