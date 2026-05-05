import { listClassrooms, getMaxClassroomNumber, bulkInsertClassrooms } from '../../lib/db';
import { getAuthScope } from '../../lib/auth';

/**
 * 教室一括追加 API（CSV取込用）
 * POST /api/add-classrooms
 * 認証: 管理者 / 事業者 / 教室トークン必須
 *
 * 教室コードは自動採番: {operatorCode}-C{01,02,...}
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authScope = await getAuthScope(req, res);
  if (!authScope) return;

  const { operatorCode, classrooms: newClassrooms } = req.body;
  if (authScope.scope !== 'admin' && operatorCode) {
    if (String(operatorCode).toUpperCase() !== authScope.operatorCode) {
      return res.status(403).json({ error: 'このデータへのアクセス権がありません。' });
    }
  }
  if (!operatorCode || !Array.isArray(newClassrooms) || newClassrooms.length === 0) {
    return res.status(400).json({ error: 'operatorCode と classrooms（配列）は必須です。' });
  }

  try {
    const opCode = String(operatorCode).trim().toUpperCase();
    const existing = await listClassrooms({ operatorCode: opCode });
    let maxNum = await getMaxClassroomNumber(opCode);

    const added = [];
    const skipped = [];
    const today = new Date().toISOString().slice(0, 10);
    const toInsert = [];

    for (const item of newClassrooms) {
      const name = (item.classroomName || '').trim();
      if (!name) { skipped.push('（空欄）'); continue; }
      if (['本部', '本社', '事務局'].includes(name)) {
        skipped.push(`${name}（本部専用URLをご利用ください）`);
        continue;
      }
      const duplicate = existing.find((c) => c.classroomName === name);
      if (duplicate) { skipped.push(name); continue; }

      maxNum += 1;
      const classroomCode = `${opCode}-C${String(maxNum).padStart(2, '0')}`;
      const entry = {
        classroomCode,
        operatorCode: opCode,
        classroomName: name,
        classroomPassword: classroomCode, // 初期パスワードは教室コードと同じ
        isHQ: false,
        status: 'active',
        createdAt: today,
      };
      toInsert.push(entry);
      added.push(entry);
    }

    if (toInsert.length > 0) {
      await bulkInsertClassrooms(toInsert);
    }
    return res.status(200).json({ success: true, added, skipped });
  } catch (err) {
    console.error('add-classrooms エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
