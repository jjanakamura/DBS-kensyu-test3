/**
 * 既存の data/*.json を Supabase に移行するスクリプト
 *
 * 使い方:
 *   1. 事前に supabase/schema.sql を Supabase で実行済みであること
 *   2. .env.local に Supabase 接続情報が設定されていること
 *   3. node scripts/seed-from-json.mjs
 *
 * 既存データを upsert（id一致なら更新、なければ追加）するので、何度実行しても安全。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(PROJECT_ROOT, '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY  = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SECRET_KEY) {
  console.error('❌ .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SECRET_KEY を設定してください');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false },
});

function readJson(filename) {
  const p = path.join(PROJECT_ROOT, 'data', filename);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf-8') || '[]');
}

async function upsertTable(tableName, rows, conflictKey) {
  if (rows.length === 0) {
    console.log(`  ℹ️ ${tableName}: 移行対象なし`);
    return;
  }
  console.log(`  📤 ${tableName}: ${rows.length}件を移行中...`);
  // 100件ずつバッチ
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await sb.from(tableName).upsert(batch, { onConflict: conflictKey });
    if (error) {
      console.error(`  ❌ ${tableName} バッチ ${i}-${i + batch.length} で失敗:`, error.message);
      throw error;
    }
  }
  console.log(`  ✅ ${tableName}: ${rows.length}件 移行完了`);
}

async function main() {
  console.log('🚀 JSON → Supabase データ移行を開始します\n');

  // operators
  const operators = readJson('operators.json');
  await upsertTable('operators', operators, 'operatorCode');

  // classrooms
  const classrooms = readJson('classrooms.json').map((c) => ({
    ...c,
    isHQ: !!c.isHQ,
  }));
  await upsertTable('classrooms', classrooms, 'classroomCode');

  // members（旧仕様の互換性用）— 必要な列だけ取り出す
  const membersRaw = readJson('members.json');
  const members = membersRaw.map((m) => ({
    memberCode: m.memberCode,
    companyName: m.companyName,
    status: m.status || 'active',
  }));
  await upsertTable('members', members, 'memberCode');

  // trainees
  const trainees = readJson('trainees.json').map((t) => ({
    ...t,
    serverFailCount: t.serverFailCount || 0,
  }));
  await upsertTable('trainees', trainees, 'id');

  // records（schema にある列だけ取り出して整形）
  const recordsRaw = readJson('records.json');
  const records = recordsRaw.map((r) => ({
    id: r.id,
    operatorCode: r.operatorCode || r.memberCode || '',
    memberCode: r.memberCode || null,
    classroomCode: r.classroomCode || null,
    companyName: r.companyName || '',
    classroomName: r.classroomName || '',
    fullName: r.fullName,
    email: r.email || '',
    track: r.track === 'manager' ? 'manager' : 'general',
    score: r.score ?? null,
    correctCount: r.correctCount ?? null,
    totalQuestions: r.totalQuestions ?? null,
    passed: !!r.passed,
    failCount: r.failCount ?? 0,
    completionDate: r.completionDate || null,
    certNumber: r.certNumber || null,
    answers: r.answers || null,
    submittedAt: r.submittedAt || new Date().toISOString(),
  }));
  await upsertTable('records', records, 'id');

  console.log('\n🎉 すべてのデータ移行が完了しました！');
}

main().catch((err) => {
  console.error('\n💥 移行失敗:', err);
  process.exit(1);
});
