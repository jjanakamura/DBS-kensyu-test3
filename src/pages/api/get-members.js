import path from 'path';
import fs from 'fs';

/**
 * 会員一覧取得 API（管理画面用）
 * GET /api/get-members
 *
 * レスポンス: { members: Member[] }
 * ※ 管理画面専用。本番では認証ミドルウェアを追加すること。
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'members.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const members = JSON.parse(raw);
    return res.status(200).json({ members });
  } catch (err) {
    console.error('members.json の読み込みエラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
