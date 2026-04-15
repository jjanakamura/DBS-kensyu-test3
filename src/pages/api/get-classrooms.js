import fs from 'fs';
import { getDataDir } from '../../lib/dataPath';
import { getAuthScope } from '../../lib/auth';

/**
 * 教室一覧取得 API
 * GET /api/get-classrooms?operatorCode=A001
 * 認証: 管理者 / 事業者 / 教室トークン必須
 *   - 管理者   : 全件取得可（operatorCode 省略時は全件）
 *   - 事業者   : 自社（operatorCode）のみ取得可
 *   - 教室     : 所属事業者（operatorCode）のみ取得可
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authScope = getAuthScope(req, res);
  if (!authScope) return;

  const { operatorCode } = req.query;

  // 管理者以外は operatorCode 必須、かつ自スコープ内のみ
  if (authScope.scope !== 'admin') {
    if (!operatorCode) {
      return res.status(403).json({ error: 'operatorCode の指定が必要です。' });
    }
    if (String(operatorCode).toUpperCase() !== authScope.operatorCode) {
      return res.status(403).json({ error: 'このデータへのアクセス権がありません。' });
    }
  }

  try {
    const dataDir = getDataDir();
    const classrooms = JSON.parse(fs.readFileSync(`${dataDir}/classrooms.json`, 'utf-8'));

    let result = classrooms;
    if (operatorCode) {
      const code = operatorCode.trim().toUpperCase();
      result = classrooms.filter((c) => c.operatorCode.trim().toUpperCase() === code);
    }

    // 受講記録と紐付けて受講者数・合格者数を集計
    const filePath = `${dataDir}/records.json`;
    let records = [];
    if (fs.existsSync(filePath)) {
      records = JSON.parse(fs.readFileSync(filePath, 'utf-8') || '[]');
    }

    const enriched = result.map((c) => {
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
