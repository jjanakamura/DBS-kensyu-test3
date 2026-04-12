import path from 'path';
import fs from 'fs';

/**
 * 会員コード照合 API
 * POST /api/lookup-member
 *
 * リクエスト: { code: string }
 * レスポンス:
 *   { found: true, name: string }          // 有効な会員コード
 *   { found: false }                        // 存在しないコード
 *   { found: false, inactive: true }        // 停止中のコード
 *
 * data/members.json から会員コードを検索する
 * 本番では DB 参照に差し替えること
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'code は必須です。' });
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'members.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const members = JSON.parse(raw);

    // 大文字小文字を問わず、前後スペースを除いて照合
    const normalizedCode = code.trim().toUpperCase();
    const member = members.find(
      (m) => m.memberCode.trim().toUpperCase() === normalizedCode
    );

    if (!member) {
      return res.status(200).json({ found: false });
    }

    // 停止中（inactive）は受講不可
    if (member.status === 'inactive') {
      return res.status(200).json({ found: false, inactive: true });
    }

    return res.status(200).json({ found: true, name: member.companyName });
  } catch (err) {
    console.error('members.json の読み込みエラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
