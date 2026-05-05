import { listOperators, listClassrooms, listRecords } from '../../lib/db';
import { requireAdmin } from '../../lib/auth';

/**
 * 事業者一覧取得 API（JJA管理画面専用）
 * GET /api/get-operators
 * 認証: 管理者トークン必須
 *
 * ?includePasswords=true を付けると adminPassword も含めて返す
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const { includePasswords } = req.query;
  try {
    const operators = await listOperators({ includePasswords: includePasswords === 'true' });
    const classrooms = await listClassrooms();
    const records = await listRecords({ includeAnswers: false });

    const enriched = operators.map((op) => {
      const opClassrooms = classrooms.filter((c) => c.operatorCode === op.operatorCode);
      const opRecords = records.filter(
        (r) => (r.operatorCode || r.memberCode || '') === op.operatorCode
      );
      return {
        ...op,
        classroomCount: opClassrooms.length,
        traineeCount: opRecords.length,
        passedCount: opRecords.filter((r) => r.passed).length,
      };
    });

    return res.status(200).json({ operators: enriched });
  } catch (err) {
    console.error('get-operators エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
