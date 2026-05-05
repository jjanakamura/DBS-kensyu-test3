/**
 * CSV出力ユーティリティ
 *
 * RFC 4180 準拠のCSVエスケープ：
 *   - ダブルクォート, カンマ, 改行（CR/LF）, タブ を含むセルは必ずクォート
 *   - クォート内のダブルクォートは "" に二重化
 *   - 改行はそのまま保持（クォート内では複数行セルとして扱われる）
 *
 * ファイル出力時に UTF-8 BOM を付与し、Excel で文字化けしないよう配慮。
 */

/** セル単位のCSVエスケープ */
function escapeCell(cell) {
  const str = cell == null ? '' : String(cell);
  // 制御文字（NULL, BEL等）は除去（攻撃ベクター・データ破損防止）
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // クォートが必要な文字を含むかチェック
  const needsQuote =
    cleaned.includes('"') ||
    cleaned.includes(',') ||
    cleaned.includes('\n') ||
    cleaned.includes('\r') ||
    cleaned.includes('\t');
  if (needsQuote) {
    return `"${cleaned.replace(/"/g, '""')}"`;
  }
  return cleaned;
}

/**
 * 配列の配列（rows）を CSV 文字列に変換
 * @param {Array<Array<any>>} rows - [[ヘッダ...], [行1...], [行2...]]
 */
export function toCsv(rows) {
  return rows
    .map((row) => row.map(escapeCell).join(','))
    .join('\r\n');
}

/**
 * ブラウザでCSVファイルをダウンロード
 * @param {string} filename - 例: '受講記録_2026-05-04.csv'
 * @param {Array<Array<any>>} rows - [[ヘッダ...], [行1...], ...]
 */
export function downloadCsv(filename, rows) {
  const BOM = '﻿';
  const csv = BOM + toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // クリック処理が完了してからURLを解放
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
