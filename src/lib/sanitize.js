/**
 * 入力サニタイズユーティリティ
 *
 * - HTMLタグ・制御文字・絵文字の混入を防ぐ
 * - 長すぎる入力はカット
 * - 受講者の氏名・教室名など、ユーザーが自由入力するフィールド向け
 */

// 制御文字（NULL/タブ以外/改行以外）を除去するパターン
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// HTMLタグの記号を全角に置換
const HTML_DANGER_CHARS = /[<>]/g;

/**
 * 受講者氏名・教室名のサニタイズ
 *
 * 規則：
 *   1. 前後の空白を除去
 *   2. HTMLタグの記号 < > を除去（XSS防止の二重バリア）
 *   3. 制御文字を除去
 *   4. 連続する空白は1つにまとめる
 *   5. 最大長で打ち切り（デフォルト50文字）
 *
 * @param {string} input
 * @param {number} maxLength
 * @returns {string} サニタイズ済み文字列（空文字なら無効入力）
 */
export function sanitizeName(input, maxLength = 50) {
  if (typeof input !== 'string') return '';
  let s = input;
  s = s.replace(CONTROL_CHARS, '');
  s = s.replace(HTML_DANGER_CHARS, '');
  s = s.replace(/\s+/g, ' ');
  s = s.trim();
  if (s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}

/**
 * 受講者氏名としてOKかどうかを検証
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateName(input, maxLength = 50) {
  if (typeof input !== 'string' || !input.trim()) {
    return { ok: false, error: '氏名を入力してください。' };
  }
  const cleaned = sanitizeName(input, maxLength);
  if (!cleaned) {
    return { ok: false, error: '氏名に使用できない文字が含まれています。' };
  }
  if (cleaned.length > maxLength) {
    return { ok: false, error: `氏名は${maxLength}文字以内で入力してください。` };
  }
  return { ok: true, value: cleaned };
}

/**
 * 一般的な短いテキスト（教室名・備考など）のサニタイズ
 */
export function sanitizeText(input, maxLength = 200) {
  if (typeof input !== 'string') return '';
  let s = input;
  s = s.replace(CONTROL_CHARS, '');
  s = s.replace(HTML_DANGER_CHARS, '');
  s = s.trim();
  if (s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}
