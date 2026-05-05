import { getTrainee, updateTrainee } from '../../lib/db';
import { getAuthScope } from '../../lib/auth';

/**
 * 受講者ステータス更新 API
 * POST /api/update-trainee-status
 * 認証: 管理者 / 事業者 / 教室トークン必須
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authScope = await getAuthScope(req, res);
  if (!authScope) return;

  const { id, status, notes } = req.body;
  if (!id || !status) return res.status(400).json({ error: 'id と status は必須です。' });
  if (!['active', 'retired', 'suspended'].includes(status)) {
    return res.status(400).json({ error: '無効なステータスです。' });
  }

  try {
    const prev = await getTrainee(id);
    if (!prev) return res.status(404).json({ error: '受講者が見つかりません。' });

    // 自スコープ外なら拒否
    if (authScope.scope !== 'admin' && prev.operatorCode !== authScope.operatorCode) {
      return res.status(403).json({ error: 'このデータへのアクセス権がありません。' });
    }

    const now = new Date().toISOString();
    const patch = {
      status,
      notes: notes !== undefined ? String(notes) : prev.notes,
      retiredAt: status === 'retired' && !prev.retiredAt ? now : prev.retiredAt,
      statusUpdatedAt: now,
    };
    const updated = await updateTrainee(id, patch);
    return res.status(200).json({ success: true, trainee: updated });
  } catch (err) {
    console.error('update-trainee-status エラー:', err);
    return res.status(500).json({ error: 'ステータスの更新に失敗しました。' });
  }
}
