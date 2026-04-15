import fs from 'fs';
import { getDataPath } from '../../lib/dataPath';
import { getAuthScope } from '../../lib/auth';

/**
 * 受講者削除 API
 * POST /api/delete-trainee
 * 認証: 管理者 / 事業者 / 教室トークン必須
 *
 * リクエスト: { id }
 * - 対象受講者が "suspended"（停止中）の場合のみ削除を許可
 * レスポンス: { success: true } | { error: string }
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authScope = getAuthScope(req, res);
  if (!authScope) return;

  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'id は必須です。' });
  }

  try {
    const filePath = getDataPath('trainees.json');
    let trainees = JSON.parse(fs.readFileSync(filePath, 'utf-8') || '[]');

    const idx = trainees.findIndex((t) => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: '受講者が見つかりません。' });
    }

    const target = trainees[idx];
    if (target.status !== 'suspended') {
      return res.status(400).json({ error: '停止中の受講者のみ削除できます。' });
    }

    trainees.splice(idx, 1);
    fs.writeFileSync(filePath, JSON.stringify(trainees, null, 2), 'utf-8');

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('delete-trainee エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
