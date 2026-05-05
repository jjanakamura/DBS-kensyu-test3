import { listTrainees } from '../../lib/db';
import { getAuthScope } from '../../lib/auth';

/**
 * 受講者一覧取得 API
 * GET /api/get-trainees
 * 認証: 管理者 / 事業者 / 教室トークン必須
 *   - 管理者   : 全件取得可
 *   - 事業者   : 自社（operatorCode）のみ取得可
 *   - 教室     : 所属事業者（operatorCode）のみ取得可
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authScope = await getAuthScope(req, res);
  if (!authScope) return;

  const { operatorCode, includeRetired, search } = req.query;

  if (authScope.scope !== 'admin') {
    if (!operatorCode) {
      return res.status(403).json({ error: 'operatorCode の指定が必要です。' });
    }
    if (String(operatorCode).toUpperCase() !== authScope.operatorCode) {
      return res.status(403).json({ error: 'このデータへのアクセス権がありません。' });
    }
  }

  try {
    const trainees = await listTrainees({
      operatorCode: operatorCode || undefined,
      includeRetired: includeRetired === 'true',
      search: search || undefined,
    });
    return res.status(200).json({ trainees });
  } catch (err) {
    console.error('get-trainees エラー:', err);
    return res.status(500).json({ error: 'データの読み込みに失敗しました。' });
  }
}
