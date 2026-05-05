import { insertAccessLog } from './db';

/**
 * アクセスログ書き込みユーティリティ（Supabase版）
 *
 * ログに記録する情報：
 *   type      : 'admin' | 'operator' | 'classroom'
 *   target    : 'ADMIN' | 事業者コード | 教室コード
 *   result    : 'success' | 'fail'
 *   reason    : 失敗理由（成功時は空文字）
 *   ip        : アクセス元IPアドレス（参考情報）
 *   user_agent: ブラウザ情報
 *
 * ※ 氏名・パスワード等の個人情報・機密情報は一切記録しない
 * ※ DB側で BIGSERIAL なので件数制限は無し（必要なら別途 cron で古いログ削除）
 */
export async function writeAccessLog({ type, target, result, reason = '', req }) {
  try {
    const ip =
      (req?.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      'unknown';
    const ua = (req?.headers?.['user-agent'] || '').slice(0, 200);

    await insertAccessLog({
      type,
      target,
      result,
      reason,
      ip,
      user_agent: ua,
    });
  } catch (err) {
    // ログ書き込み失敗はサイレントエラー（本来の処理を止めない）
    console.error('[accessLog] write error:', err);
  }
}
