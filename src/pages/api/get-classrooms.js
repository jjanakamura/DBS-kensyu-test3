import { listClassrooms, listRecords } from '../../lib/db';
import { getAuthScope } from '../../lib/auth';

/**
 * 教室一覧取得 API
 * GET /api/get-classrooms?operatorCode=A001
 * 認証: 管理者 / 事業者 / 教室トークン必須
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authScope = await getAuthScope(req, res);
  if (!authScope) return;

  const { operatorCode } = req.query;

  if (authScope.scope !== 'admin') {
    if (!operatorCode) {
      return res.status(403).json({ error: 'operatorCode の指定が必要です。' });
    }
    if (String(operatorCode).toUpperCase() !== authScope.operatorCode) {
      return res.status(403).json({ error: 'このデータへのアクセス権がありません。' });
    }
  }

  try {
    const classrooms = await listClassrooms({ operatorCode: operatorCode || undefined });
    const records = await listRecords({ includeAnswers: false });

    const enriched = classrooms.map((c) => {
      const clsRecords = records.filter((r) => r.classroomCode === c.classroomCode);
      return {
        ...c,
        totalTrainees: clsRecords.length,
        passedTrainees: clsRecords.filter((r) => r.passed).length,
      };
    });

    return res.status(200).json({ classrooms: enriched });
  } catch (err) {
    console.error('get-classrooms エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
