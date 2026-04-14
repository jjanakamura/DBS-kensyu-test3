import fs from 'fs';
import { getDataPath } from '../../../lib/dataPath';

/**
 * 個人情報自動削除 API
 * GET  /api/cron/cleanup-trainees  → Vercel Cron Job（毎日自動実行）
 * POST /api/cron/cleanup-trainees  → 管理画面から手動実行
 *
 * 削除ルール（JIS Q 15001 / 個人情報保護法 準拠）:
 *   Rule 1: ステータス「停止中」かつ停止処理から 30日 超過
 *   Rule 2: ステータス「在籍中」かつ研修有効期限から 30日 超過
 *   Rule 3: ステータス「退職済み」かつ退職処理から 90日 超過
 *
 * ・受講者プロファイル（trainees.json）と受講記録（records.json）を両方削除
 * ・削除ログ（cleanup-log.json）には個人情報を含まず ID のみ記録
 */

export const CLEANUP_RULES = {
  suspendedDays: 30,        // 停止中 → 30日後
  expiredActiveDays: 30,    // 在籍中＋有効期限切れ → 30日後
  retiredDays: 90,          // 退職済み → 90日後
};

/** "2026年4月12日" → Date オブジェクト */
function parseJpDate(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
  if (!m) return null;
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
}

/** completionDate → 有効期限 Date（1年後） */
function getExpiryDate(completionDate) {
  const d = parseJpDate(completionDate);
  if (!d) return null;
  return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate());
}

/** 日付差（日数） */
function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

/**
 * 削除対象判定
 * @returns {{ shouldDelete: boolean, reason: string }}
 */
function checkDeletion(trainee, records, now) {
  // Rule 1: 停止中
  if (trainee.status === 'suspended') {
    const base = trainee.statusUpdatedAt;
    const days = daysSince(base);
    if (days !== null && days >= CLEANUP_RULES.suspendedDays) {
      return {
        shouldDelete: true,
        reason: `停止中${days}日経過（基準: ${CLEANUP_RULES.suspendedDays}日、停止日: ${base?.slice(0, 10) ?? '不明'}）`,
        rule: 'suspended',
      };
    }
  }

  // Rule 2: 在籍中 + 有効期限切れ
  if (trainee.status === 'active') {
    const passed = records
      .filter(
        (r) =>
          r.passed &&
          r.operatorCode === trainee.operatorCode &&
          r.fullName === trainee.fullName
      )
      .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));

    if (passed.length > 0) {
      const expiry = getExpiryDate(passed[0].completionDate);
      if (expiry) {
        const daysOver = Math.floor((now - expiry.getTime()) / 86400000);
        if (daysOver >= CLEANUP_RULES.expiredActiveDays) {
          return {
            shouldDelete: true,
            reason: `有効期限切れ${daysOver}日超過（基準: ${CLEANUP_RULES.expiredActiveDays}日、有効期限: ${expiry.toISOString().slice(0, 10)}）`,
            rule: 'expired_active',
          };
        }
      }
    }
  }

  // Rule 3: 退職済み
  if (trainee.status === 'retired') {
    const base = trainee.retiredAt || trainee.statusUpdatedAt;
    const days = daysSince(base);
    if (days !== null && days >= CLEANUP_RULES.retiredDays) {
      return {
        shouldDelete: true,
        reason: `退職済み${days}日経過（基準: ${CLEANUP_RULES.retiredDays}日、退職日: ${base?.slice(0, 10) ?? '不明'}）`,
        rule: 'retired',
      };
    }
  }

  return { shouldDelete: false, reason: '', rule: null };
}

/**
 * クリーンアップ実行
 * @param {boolean} dryRun - true の場合は削除せず結果だけ返す
 */
export function runCleanup(dryRun = false) {
  const traineesPath = getDataPath('trainees.json');
  const recordsPath  = getDataPath('records.json');
  const logPath      = getDataPath('cleanup-log.json');

  let trainees = [];
  let records  = [];
  let logs     = [];

  if (fs.existsSync(traineesPath))
    trainees = JSON.parse(fs.readFileSync(traineesPath, 'utf-8') || '[]');
  if (fs.existsSync(recordsPath))
    records = JSON.parse(fs.readFileSync(recordsPath, 'utf-8') || '[]');
  if (fs.existsSync(logPath))
    logs = JSON.parse(fs.readFileSync(logPath, 'utf-8') || '[]');

  const now = Date.now();
  const toDelete = [];
  const toKeep   = [];

  for (const trainee of trainees) {
    const { shouldDelete, reason, rule } = checkDeletion(trainee, records, now);
    if (shouldDelete) {
      toDelete.push({ id: trainee.id, operatorCode: trainee.operatorCode, reason, rule });
    } else {
      toKeep.push(trainee);
    }
  }

  let deletedRecordsCount = 0;

  if (!dryRun && toDelete.length > 0) {
    // 削除対象の operatorCode + fullName セット（records 側の特定に使用）
    const deleteKeySet = new Set(
      trainees
        .filter((t) => toDelete.some((d) => d.id === t.id))
        .map((t) => `${t.operatorCode}::${t.fullName}`)
    );

    const remainingRecords = records.filter(
      (r) => !deleteKeySet.has(`${r.operatorCode}::${r.fullName}`)
    );
    deletedRecordsCount = records.length - remainingRecords.length;

    // ファイル書き込み
    fs.writeFileSync(traineesPath, JSON.stringify(toKeep, null, 2), 'utf-8');
    fs.writeFileSync(recordsPath, JSON.stringify(remainingRecords, null, 2), 'utf-8');

    // 削除ログ（個人情報なし・ID のみ）
    logs.unshift({
      runAt: new Date(now).toISOString(),
      deletedTraineesCount: toDelete.length,
      deletedRecordsCount,
      deletedIds: toDelete.map((d) => d.id),
      ruleBreakdown: {
        suspended: toDelete.filter((d) => d.rule === 'suspended').length,
        expired_active: toDelete.filter((d) => d.rule === 'expired_active').length,
        retired: toDelete.filter((d) => d.rule === 'retired').length,
      },
      rules: CLEANUP_RULES,
      dryRun: false,
    });
    if (logs.length > 100) logs = logs.slice(0, 100);
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf-8');
  }

  return {
    dryRun,
    runAt: new Date(now).toISOString(),
    totalTrainees: trainees.length,
    deletedTraineesCount: toDelete.length,
    deletedRecordsCount: dryRun ? '（試算）' : deletedRecordsCount,
    keptCount: toKeep.length,
    deletedItems: toDelete,
    rules: CLEANUP_RULES,
  };
}

// ─────────────────────────────────────────────
// API ハンドラ
// ─────────────────────────────────────────────
export default function handler(req, res) {
  // GET: Vercel Cron Job からの自動実行
  if (req.method === 'GET') {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const result = runCleanup(false);
      console.log('[cleanup-trainees] cron run:', result);
      return res.status(200).json(result);
    } catch (err) {
      console.error('[cleanup-trainees] error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // POST: 管理画面からの手動実行
  if (req.method === 'POST') {
    const { dryRun = false } = req.body || {};
    try {
      const result = runCleanup(Boolean(dryRun));
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
