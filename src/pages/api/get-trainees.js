import fs from 'fs';
import { getDataPath } from '../../lib/dataPath';
import { getAuthScope } from '../../lib/auth';

/**
 * 受講者一覧取得 API
 * GET /api/get-trainees
 * 認証: 管理者 / 事業者 / 教室トークン必須
 *   - 管理者   : 全件取得可
 *   - 事業者   : 自社（operatorCode）のみ取得可
 *   - 教室     : 所属事業者（operatorCode）のみ取得可
 *
 * クエリパラメータ:
 *   operatorCode   : 事業者コードで絞り込み（管理者以外は必須）
 *   includeRetired : "true" で退職者を含む
 *   search         : 氏名・事業者コード・教室名で部分一致
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authScope = getAuthScope(req, res);
  if (!authScope) return;

  const { operatorCode, includeRetired, search } = req.query;

  // 管理者以外は operatorCode が必須、かつ自スコープ内のみアクセス可
  if (authScope.scope !== 'admin') {
    if (!operatorCode) {
      return res.status(403).json({ error: 'operatorCode の指定が必要です。' });
    }
    if (String(operatorCode).toUpperCase() !== authScope.operatorCode) {
      return res.status(403).json({ error: 'このデータへのアクセス権がありません。' });
    }
  }

  try {
    const filePath = getDataPath('trainees.json');
    let trainees = [];
    if (fs.existsSync(filePath)) {
      trainees = JSON.parse(fs.readFileSync(filePath, 'utf-8') || '[]');
    }

    if (operatorCode) {
      trainees = trainees.filter((t) => t.operatorCode === operatorCode);
    }

    if (includeRetired !== 'true') {
      trainees = trainees.filter((t) => t.status !== 'retired');
    }

    if (search) {
      const s = search.toLowerCase();
      trainees = trainees.filter(
        (t) =>
          (t.fullName || '').includes(search) ||
          (t.operatorCode || '').toLowerCase().includes(s) ||
          (t.companyName || '').includes(search) ||
          (t.classroomName || '').includes(search)
      );
    }

    return res.status(200).json({ trainees });
  } catch (err) {
    console.error('trainees.json の読み込みエラー:', err);
    return res.status(500).json({ error: 'データの読み込みに失敗しました。' });
  }
}
