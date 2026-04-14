import fs from 'fs';
import { getDataPath } from '../../lib/dataPath';

/**
 * 受講記録保存 API
 * POST /api/submit-record
 *
 * リクエスト: 受講者情報 + 採点結果オブジェクト
 * レスポンス: { success: boolean, id: string }
 *
 * data/records.json にファイルベースで追記保存する
 * ⚠ 本番では DB（PostgreSQL 等）への保存に差し替えること
 * ⚠ 高頻度・同時アクセスには対応していない（試作版）
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const record = req.body;

  // 必須フィールドの簡易チェック（operatorCode または memberCode）
  const codeField = record.operatorCode || record.memberCode;
  if (!record || !codeField || !record.fullName) {
    return res.status(400).json({ error: '必須フィールドが不足しています。' });
  }

  try {
    const filePath = getDataPath('records.json');

    let records = [];
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      records = JSON.parse(raw || '[]');
    }

    const newRecord = {
      ...record,
      id: `REC-${Date.now()}-${String(records.length + 1).padStart(4, '0')}`,
      // operatorCode を正規フィールドとして保存（旧 memberCode との後方互換を維持）
      operatorCode: record.operatorCode || record.memberCode || '',
      classroomCode: record.classroomCode || '',
    };

    records.push(newRecord);
    fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf-8');

    // ===== 受講者プロファイルのアップサート（trainees.json） =====
    // 事業者コード + 氏名 をキーに同一人物を判定
    const traineeFilePath = getDataPath('trainees.json');
    let trainees = [];
    if (fs.existsSync(traineeFilePath)) {
      trainees = JSON.parse(fs.readFileSync(traineeFilePath, 'utf-8') || '[]');
    }

    const existingIdx = trainees.findIndex(
      (t) =>
        t.operatorCode === (newRecord.operatorCode || newRecord.memberCode || '') &&
        t.fullName === (newRecord.fullName || '')
    );

    if (existingIdx >= 0) {
      trainees[existingIdx] = {
        ...trainees[existingIdx],
        latestRecordId: newRecord.id,
        classroomCode: newRecord.classroomCode || trainees[existingIdx].classroomCode,
        classroomName: newRecord.classroomName || trainees[existingIdx].classroomName,
        companyName: newRecord.companyName || trainees[existingIdx].companyName,
        track: newRecord.track || trainees[existingIdx].track,
      };
    } else {
      trainees.push({
        id: `TRN-${Date.now()}-${String(trainees.length + 1).padStart(4, '0')}`,
        operatorCode: newRecord.operatorCode || newRecord.memberCode || '',
        companyName: newRecord.companyName || '',
        classroomCode: newRecord.classroomCode || '',
        classroomName: newRecord.classroomName || '',
        fullName: newRecord.fullName || '',
        track: newRecord.track || 'general',
        status: 'active',
        retiredAt: null,
        statusUpdatedAt: null,
        notes: '',
        registeredAt: new Date().toISOString().slice(0, 10),
        latestRecordId: newRecord.id,
      });
    }
    fs.writeFileSync(traineeFilePath, JSON.stringify(trainees, null, 2), 'utf-8');

    return res.status(200).json({ success: true, id: newRecord.id });
  } catch (err) {
    console.error('records.json の書き込みエラー:', err);
    return res.status(500).json({ error: '記録の保存に失敗しました。' });
  }
}
