import { listRecords } from '../../lib/db';
import { getAuthScope } from '../../lib/auth';

/**
 * 事業者別受講記録取得 API
 * GET /api/get-operator-records?operatorCode=A001&passedOnly=true
 * 認証: 管理者 / 事業者 / 教室トークン必須
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authScope = await getAuthScope(req, res);
  if (!authScope) return;

  const { operatorCode, passedOnly } = req.query;

  if (authScope.scope !== 'admin') {
    if (!operatorCode) return res.status(403).json({ error: 'operatorCode の指定が必要です。' });
    if (String(operatorCode).toUpperCase() !== authScope.operatorCode) {
      return res.status(403).json({ error: 'このデータへのアクセス権がありません。' });
    }
  }
  if (!operatorCode) return res.status(400).json({ error: 'operatorCode は必須です。' });

  try {
    const records = await listRecords({
      operatorCode,
      passed: passedOnly === 'true' ? true : undefined,
      includeAnswers: false,
    });
    return res.status(200).json({ records });
  } catch (err) {
    console.error('get-operator-records エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
