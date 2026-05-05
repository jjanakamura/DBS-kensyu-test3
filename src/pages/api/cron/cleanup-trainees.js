import { listTrainees, deleteTraineesByIds, deleteRecordsByOperatorAndNames } from '../../../lib/db';
import { requireAdmin } from '../../../lib/auth';

/**
 * 個人情報自動削除 API
 * GET  /api/cron/cleanup-trainees  → Vercel Cron Job（毎日自動実行）
 * POST /api/cron/cleanup-trainees  → 管理画面から手動実行
 *
 * 削除ルール（JIS Q 15001 / 個人情報保護法 / ISO 27001 準拠）:
 *   Rule 1: ステータス「停止中」かつ停止処理から 30日 超過 → 削除
 *   Rule 2: ステータス「在籍中」かつ有効期限切れ → 【削除しない・警告表示のみ】
 *   Rule 3: ステータス「退職済み」かつ退職処理から 90日 超過 → 削除
 */

export const CLEANUP_RULES = {
  suspendedDays: 30,
  retiredDays: 90,
};

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function checkDeletion(trainee) {
  if (trainee.status === 'suspended') {
    const base = trainee.statusUpdatedAt;
    const days = daysSince(base);
    if (days !== null && days >= CLEANUP_RULES.suspendedDays) {
      return {
        shouldDelete: true,
        reason: `停止中${days}日経過（基準: ${CLEANUP_RULES.suspendedDays}日）`,
        rule: 'suspended',
      };
    }
  }
  if (trainee.status === 'retired') {
    const base = trainee.retiredAt || trainee.statusUpdatedAt;
    const days = daysSince(base);
    if (days !== null && days >= CLEANUP_RULES.retiredDays) {
      return {
        shouldDelete: true,
        reason: `退職済み${days}日経過（基準: ${CLEANUP_RULES.retiredDays}日）`,
        rule: 'retired',
      };
    }
  }
  return { shouldDelete: false, reason: '', rule: null };
}

/** クリーンアップ実行 */
export async function runCleanup(dryRun = false) {
  const trainees = await listTrainees({ includeRetired: true });
  const toDelete = [];
  const toKeep = [];

  for (const trainee of trainees) {
    const { shouldDelete, reason, rule } = checkDeletion(trainee);
    if (shouldDelete) {
      toDelete.push({ id: trainee.id, operatorCode: trainee.operatorCode, fullName: trainee.fullName, reason, rule });
    } else {
      toKeep.push(trainee);
    }
  }

  let deletedRecordsCount = 0;
  if (!dryRun && toDelete.length > 0) {
    const ids = toDelete.map((d) => d.id);
    await deleteTraineesByIds(ids);
    const opNamePairs = toDelete.map((d) => ({ operatorCode: d.operatorCode, fullName: d.fullName }));
    deletedRecordsCount = await deleteRecordsByOperatorAndNames(opNamePairs);
  }

  return {
    dryRun,
    runAt: new Date().toISOString(),
    totalTrainees: trainees.length,
    deletedTraineesCount: toDelete.length,
    deletedRecordsCount: dryRun ? '（試算）' : deletedRecordsCount,
    keptCount: toKeep.length,
    deletedItems: toDelete.map(({ fullName, ...rest }) => rest), // 個人情報除外
    rules: CLEANUP_RULES,
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      console.error('[cleanup-trainees] CRON_SECRET が未設定です。');
      return res.status(503).json({ error: 'CRON_SECRET 未設定のためサービスが利用できません。' });
    }
    if (req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const result = await runCleanup(false);
      console.log('[cleanup-trainees] cron run:', result);
      return res.status(200).json(result);
    } catch (err) {
      console.error('[cleanup-trainees] error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const { dryRun = false } = req.body || {};
    try {
      const result = await runCleanup(Boolean(dryRun));
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
