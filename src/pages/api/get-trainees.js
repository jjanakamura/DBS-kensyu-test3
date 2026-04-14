import fs from 'fs';
import { getDataPath } from '../../lib/dataPath';

/**
 * 受講者一覧取得 API
 * GET /api/get-trainees
 *
 * クエリパラメータ:
 *   operatorCode   : 事業者コードで絞り込み（省略時は全件）
 *   includeRetired : "true" で退職者を含む（省略時は active + suspended のみ）
 *   search         : 氏名・事業者コード・教室名で部分一致
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { operatorCode, includeRetired, search } = req.query;

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
