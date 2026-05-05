/**
 * データレイヤ（Supabase 経由）
 *
 * 全 API は本ファイルの関数を経由して DB アクセスする。
 * 以前の JSON ファイル方式と同じ呼び出しシグネチャを維持し、
 * UI コードの変更なしで動作させることが目標。
 *
 * 注意:
 *   - すべての書き込み・読み取りは「サーバー側」（pages/api/）からのみ行う
 *   - クライアント側からは API 経由でのみアクセス
 *   - 列名は camelCase（Supabaseに合わせて引用符付きで定義済み）
 */
import { supabaseAdmin } from './supabase';

function db() {
  if (!supabaseAdmin) {
    throw new Error('Supabase クライアントが未初期化です。環境変数を確認してください。');
  }
  return supabaseAdmin;
}

// ============================================================
// Operators（事業者）
// ============================================================

/** 全事業者を返す（オプション: includePasswords でパスワード列を含むかどうか） */
export async function listOperators({ includePasswords = false } = {}) {
  const cols = includePasswords ? '*' : 'operatorCode,companyName,contactName,contactEmail,status,registeredAt,note,created_at,updated_at';
  const { data, error } = await db().from('operators').select(cols).order('operatorCode');
  if (error) throw error;
  return data || [];
}

/** 事業者コードで1件取得（無ければ null） */
export async function getOperator(operatorCode) {
  if (!operatorCode) return null;
  const code = String(operatorCode).trim().toUpperCase();
  const { data, error } = await db().from('operators').select('*').eq('operatorCode', code).maybeSingle();
  if (error) return null;
  return data || null;
}

/** 事業者を新規登録（重複時はエラー） */
export async function insertOperator(operator) {
  const { data, error } = await db().from('operators').insert(operator).select().single();
  if (error) throw error;
  return data;
}

/** 事業者を更新（部分更新） */
export async function updateOperator(operatorCode, patch) {
  const code = String(operatorCode).trim().toUpperCase();
  const { data, error } = await db().from('operators').update(patch).eq('operatorCode', code).select().single();
  if (error) throw error;
  return data;
}

/** 事業者を一括登録（重複ならスキップ） */
export async function bulkInsertOperators(rows) {
  const { data, error } = await db().from('operators').insert(rows).select();
  if (error) throw error;
  return data || [];
}

// ============================================================
// Classrooms（教室）
// ============================================================

/** 全教室を返す（オプション: operatorCode で絞り込み） */
export async function listClassrooms({ operatorCode, activeOnly = false } = {}) {
  let q = db().from('classrooms').select('*').order('classroomCode');
  if (operatorCode) q = q.eq('operatorCode', String(operatorCode).trim().toUpperCase());
  if (activeOnly) q = q.eq('status', 'active');
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** 教室コードで1件取得 */
export async function getClassroom(classroomCode) {
  if (!classroomCode) return null;
  const code = String(classroomCode).trim().toUpperCase();
  const { data, error } = await db().from('classrooms').select('*').eq('classroomCode', code).maybeSingle();
  if (error) return null;
  return data || null;
}

/** 事業者コード×教室コード で取得（active 限定） */
export async function findClassroom(operatorCode, classroomCode, { activeOnly = true } = {}) {
  if (!operatorCode || !classroomCode) return null;
  const op = String(operatorCode).trim().toUpperCase();
  const cls = String(classroomCode).trim().toUpperCase();
  let q = db().from('classrooms').select('*').eq('operatorCode', op).eq('classroomCode', cls);
  if (activeOnly) q = q.eq('status', 'active');
  const { data, error } = await q.maybeSingle();
  if (error) return null;
  return data || null;
}

/** 教室を新規登録 */
export async function insertClassroom(classroom) {
  const { data, error } = await db().from('classrooms').insert(classroom).select().single();
  if (error) throw error;
  return data;
}

/** 教室を一括登録 */
export async function bulkInsertClassrooms(rows) {
  if (!rows || rows.length === 0) return [];
  const { data, error } = await db().from('classrooms').insert(rows).select();
  if (error) throw error;
  return data || [];
}

/** 教室を更新 */
export async function updateClassroom(classroomCode, patch) {
  const code = String(classroomCode).trim().toUpperCase();
  const { data, error } = await db().from('classrooms').update(patch).eq('classroomCode', code).select().single();
  if (error) throw error;
  return data;
}

/** ある事業者の C-番号の最大値を取得（CSV取込時の自動採番用） */
export async function getMaxClassroomNumber(operatorCode) {
  const op = String(operatorCode).trim().toUpperCase();
  const { data, error } = await db()
    .from('classrooms')
    .select('classroomCode')
    .eq('operatorCode', op)
    .like('classroomCode', `${op}-C%`);
  if (error) throw error;
  let maxNum = 0;
  for (const row of data || []) {
    const m = String(row.classroomCode).match(/-C(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return maxNum;
}

// ============================================================
// Trainees（受講者プロファイル）
// ============================================================

/** 受講者一覧 */
export async function listTrainees({ operatorCode, classroomCode, status, search, includeRetired = true } = {}) {
  let q = db().from('trainees').select('*').order('registeredAt', { ascending: false, nullsFirst: false });
  if (operatorCode) q = q.eq('operatorCode', String(operatorCode).trim().toUpperCase());
  if (classroomCode) q = q.eq('classroomCode', String(classroomCode).trim().toUpperCase());
  if (status) q = q.eq('status', status);
  if (!includeRetired) q = q.neq('status', 'retired');
  if (search) {
    const s = String(search);
    q = q.or(`fullName.ilike.%${s}%,classroomName.ilike.%${s}%,companyName.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** 受講者を ID で取得 */
export async function getTrainee(id) {
  if (!id) return null;
  const { data, error } = await db().from('trainees').select('*').eq('id', id).maybeSingle();
  if (error) return null;
  return data || null;
}

/** 事業者コード × 氏名 で受講者を検索（同一人物判定） */
export async function findTraineeByOperatorAndName(operatorCode, fullName) {
  if (!operatorCode || !fullName) return null;
  const op = String(operatorCode).trim().toUpperCase();
  const { data, error } = await db()
    .from('trainees')
    .select('*')
    .eq('operatorCode', op)
    .eq('fullName', fullName)
    .maybeSingle();
  if (error) return null;
  return data || null;
}

/** 受講者を upsert（id があれば更新、無ければ insert） */
export async function upsertTrainee(trainee) {
  const { data, error } = await db().from('trainees').upsert(trainee, { onConflict: 'id' }).select().single();
  if (error) throw error;
  return data;
}

/** 受講者を更新 */
export async function updateTrainee(id, patch) {
  const { data, error } = await db().from('trainees').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

/** 受講者を物理削除 */
export async function deleteTrainee(id) {
  const { error } = await db().from('trainees').delete().eq('id', id);
  if (error) throw error;
  return true;
}

/** 複数受講者を一括削除 */
export async function deleteTraineesByIds(ids) {
  if (!ids || ids.length === 0) return 0;
  const { error, count } = await db().from('trainees').delete({ count: 'exact' }).in('id', ids);
  if (error) throw error;
  return count || 0;
}

// ============================================================
// Records（受講記録）
// ============================================================

/** 受講記録一覧 */
export async function listRecords({ operatorCode, classroomCode, passed, fullName, includeAnswers = true } = {}) {
  const cols = includeAnswers ? '*' : 'id,operatorCode,memberCode,classroomCode,companyName,classroomName,fullName,email,track,score,correctCount,totalQuestions,passed,failCount,completionDate,certNumber,submittedAt';
  let q = db().from('records').select(cols).order('submittedAt', { ascending: false });
  if (operatorCode) q = q.eq('operatorCode', String(operatorCode).trim().toUpperCase());
  if (classroomCode) q = q.eq('classroomCode', String(classroomCode).trim().toUpperCase());
  if (typeof passed === 'boolean') q = q.eq('passed', passed);
  if (fullName) q = q.eq('fullName', fullName);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** 受講記録を ID で取得 */
export async function getRecord(id) {
  if (!id) return null;
  const { data, error } = await db().from('records').select('*').eq('id', id).maybeSingle();
  if (error) return null;
  return data || null;
}

/** 受講記録を新規追加 */
export async function insertRecord(record) {
  const { data, error } = await db().from('records').insert(record).select().single();
  if (error) throw error;
  return data;
}

/** 複数の受講者キーに紐づく records を削除（cleanup-trainees 用） */
export async function deleteRecordsByOperatorAndNames(opNamePairs) {
  if (!opNamePairs || opNamePairs.length === 0) return 0;
  let total = 0;
  // バッチ削除（PostgREST の OR が複雑になるため、ペアごとに削除）
  for (const { operatorCode, fullName } of opNamePairs) {
    const { error, count } = await db()
      .from('records')
      .delete({ count: 'exact' })
      .eq('operatorCode', operatorCode)
      .eq('fullName', fullName);
    if (!error && count) total += count;
  }
  return total;
}

// ============================================================
// Access Logs（アクセスログ）
// ============================================================

/** ログを1件追加 */
export async function insertAccessLog(entry) {
  const { error } = await db().from('access_logs').insert(entry);
  if (error) console.error('[db.insertAccessLog] error:', error.message);
}

/** ログ一覧（直近順、limit指定） */
export async function listAccessLogs({ limit = 500, type, result } = {}) {
  let q = db().from('access_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (type && type !== 'all') q = q.eq('type', type);
  if (result && result !== 'all') q = q.eq('result', result);
  const { data, error } = await q;
  if (error) throw error;
  // 旧形式（timestamp, id）に互換させて返却
  return (data || []).map((row) => ({
    id: `LOG-${row.id}`,
    type: row.type,
    target: row.target,
    result: row.result,
    reason: row.reason,
    ip: row.ip,
    timestamp: row.created_at,
  }));
}

// ============================================================
// Members（会員：旧仕様の互換性用）
// ============================================================

export async function listMembers() {
  const { data, error } = await db().from('members').select('*').order('memberCode');
  if (error) throw error;
  return data || [];
}

export async function getMember(memberCode) {
  if (!memberCode) return null;
  const code = String(memberCode).trim().toUpperCase();
  const { data, error } = await db().from('members').select('*').eq('memberCode', code).maybeSingle();
  if (error) return null;
  return data || null;
}
