import { getTrainee, deleteTrainee } from '../../lib/db';
import { getAuthScope } from '../../lib/auth';

/**
 * 受講者削除 API
 * POST /api/delete-trainee
 * - 対象受講者が "suspended"（停止中）の場合のみ削除を許可
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authScope = await getAuthScope(req, res);
  if (!authScope) return;

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id は必須です。' });

  try {
    const target = await getTrainee(id);
    if (!target) return res.status(404).json({ error: '受講者が見つかりません。' });
    if (authScope.scope !== 'admin' && target.operatorCode !== authScope.operatorCode) {
      return res.status(403).json({ error: 'このデータへのアクセス権がありません。' });
    }
    if (target.status !== 'suspended') {
      return res.status(400).json({ error: '停止中の受講者のみ削除できます。' });
    }
    await deleteTrainee(id);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('delete-trainee エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
