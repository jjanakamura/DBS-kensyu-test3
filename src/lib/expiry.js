/**
 * 有効期限ユーティリティ（民法準拠）
 *
 * 期間計算ルール：
 *   民法第143条第2項に基づき、「期間は応当日の前日に満了する」を採用。
 *   修了日 2026年5月4日 → 有効期限 2027年5月3日（=翌年応当日の前日）
 *
 * すべての画面・APIはこのファイルの関数を経由して有効期限を扱うこと。
 * バラバラに計算するとロジックの不整合が発生するため、
 * 直接 new Date(year+1, month, day) を書かないでください。
 */

/** "2026年4月12日" 等の和暦表記 → Date オブジェクト（時刻 0:00:00 ローカル） */
export function parseJpDate(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/(\d+)年(\d+)月(\d+)日/);
  if (!m) return null;
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
}

/** Date → "YYYY年M月D日" */
export function formatJpDate(date) {
  if (!date || isNaN(date)) return null;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 修了日から有効期限の Date を返す（民法準拠）
 * 翌年の応当日の前日 = (year+1, month, day-1)
 *   例: 2026/5/4 → 2027/5/3
 *   例: 2026/3/1 → 2027/2/28（2/29がない場合は自動で前日へ繰り下がる）
 *   例: 2024/3/1（うるう年）→ 2025/2/28
 */
export function getExpiryDate(completionDate) {
  const d = parseJpDate(completionDate);
  if (!d) return null;
  // 翌年同月同日 の 1日前
  return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate() - 1);
}

/** 修了日 → 有効期限の和暦文字列（"YYYY年M月D日"） */
export function calcExpiry(completionDate) {
  const expiryDate = getExpiryDate(completionDate);
  return formatJpDate(expiryDate);
}

/**
 * 残日数を計算（負数なら期限切れ）
 *   有効期限当日 = 残り0日（その日まで有効）
 *   有効期限の翌日以降 = 期限切れ（負の値）
 */
export function calcRemainingDays(completionDate) {
  const expiryDate = getExpiryDate(completionDate);
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
}

/**
 * 期限切れ判定（boolean）
 *   今日の日付が有効期限「翌日以降」なら期限切れ
 */
export function isExpired(completionDate) {
  const remaining = calcRemainingDays(completionDate);
  return remaining !== null && remaining < 0;
}

/** 修了証の表記用キャプション */
export const EXPIRY_CAPTION = '修了日の翌日から1年間';
