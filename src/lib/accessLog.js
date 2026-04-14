import fs from 'fs';
import { getDataPath } from './dataPath';

/**
 * アクセスログ書き込みユーティリティ
 *
 * ログに記録する情報：
 *   type      : 'admin' | 'operator' | 'classroom'
 *   target    : 'ADMIN' | 事業者コード | 教室コード
 *   result    : 'success' | 'fail'
 *   reason    : 失敗理由（成功時は空文字）
 *   ip        : アクセス元IPアドレス（参考情報）
 *   timestamp : ISO8601形式の日時
 *
 * ※ 氏名・パスワード等の個人情報・機密情報は一切記録しない
 * ※ 最大1,000件保持（古いものは自動削除）
 */
export function writeAccessLog({ type, target, result, reason = '', req }) {
  try {
    const logPath = getDataPath('access-log.json');
    let logs = [];
    if (fs.existsSync(logPath)) {
      logs = JSON.parse(fs.readFileSync(logPath, 'utf-8') || '[]');
    }

    const ip =
      (req?.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      'unknown';

    logs.unshift({
      id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      target,
      result,
      reason,
      ip,
      timestamp: new Date().toISOString(),
    });

    // 最大1,000件を保持
    if (logs.length > 1000) logs = logs.slice(0, 1000);

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {
    // ログ書き込み失敗はサイレントエラー（本来の処理を止めない）
    console.error('[accessLog] write error:', err);
  }
}
