/**
 * 簡易レート制限（IPベース・インメモリ）
 *
 * 用途：ログインAPI / 公開照合APIのブルートフォース緩和
 *
 * 仕組み：
 *   - IP × エンドポイント単位で「直近N秒間のアクセス回数」をカウント
 *   - 上限を超えた場合は429（Too Many Requests）を返す
 *   - サーバー再起動でリセットされる（試作・小規模運用向け）
 *
 * 制限事項：
 *   - Vercel Serverless ではコールドスタート時に状態がクリアされる場合あり
 *     → 完全なブルートフォース対策ではなく「速度低下＋ログ取得」を主目的とする
 *   - 大規模運用では Redis / Upstash 等の外部ストアに置き換えること
 */

// IP × ルート → { count, resetAt }
const buckets = new Map();

// 古いエントリを定期掃除（メモリリーク防止）
function gc(now) {
  if (buckets.size < 1000) return;
  for (const [key, b] of buckets) {
    if (b.resetAt < now) buckets.delete(key);
  }
}

/**
 * リクエスト元のIPを推定する（プロキシ経由を考慮）
 */
export function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const first = String(xff).split(',')[0].trim();
    if (first) return first;
  }
  return (
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}

/**
 * レート制限チェック
 *
 * @param {object} req - Next.js のリクエスト
 * @param {object} res - Next.js のレスポンス
 * @param {object} options
 * @param {string} options.key      - エンドポイント識別子（例: 'admin-login'）
 * @param {number} options.limit    - 許容リクエスト数（デフォルト 10）
 * @param {number} options.windowMs - 集計ウィンドウ（ms）（デフォルト 60000=1分）
 * @returns {boolean} true=許可 / false=拒否（429返済み）
 */
export function checkRateLimit(req, res, options = {}) {
  const { key = 'default', limit = 10, windowMs = 60_000 } = options;
  const ip = getClientIp(req);
  const bucketKey = `${ip}::${key}`;
  const now = Date.now();

  gc(now);

  let bucket = buckets.get(bucketKey);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(bucketKey, bucket);
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'リクエストが多すぎます。しばらく時間をおいて再度お試しください。',
      retryAfter,
    });
    return false;
  }

  return true;
}
