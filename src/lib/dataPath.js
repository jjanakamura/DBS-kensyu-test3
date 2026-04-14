import path from 'path';
import fs from 'fs';

/**
 * データファイルのパスを解決するユーティリティ
 *
 * - ローカル環境: プロジェクトルートの data/ ディレクトリを使用
 * - Vercel 環境: /tmp/data/ を使用（書き込み可能な一時領域）
 *   初回アクセス時にプロジェクト同梱の初期データを /tmp/data/ へコピーする
 *
 * @param {string} filename - ファイル名（例: 'records.json'）
 * @returns {string} 絶対パス
 */
export function getDataPath(filename) {
  const isVercel = process.env.VERCEL === '1';

  if (!isVercel) {
    return path.join(process.cwd(), 'data', filename);
  }

  // Vercel: /tmp/data/ を使用
  const tmpDir = '/tmp/data';
  const tmpFilePath = path.join(tmpDir, filename);

  // ディレクトリがなければ作成
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // /tmp にファイルがなければ初期データをコピー
  if (!fs.existsSync(tmpFilePath)) {
    const srcPath = path.join(process.cwd(), 'data', filename);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, tmpFilePath);
    } else {
      // 初期データがない場合は空配列で初期化
      fs.writeFileSync(tmpFilePath, '[]', 'utf-8');
    }
  }

  return tmpFilePath;
}

/**
 * data ディレクトリのパスを返す（複数ファイルを扱う API 向け）
 */
export function getDataDir() {
  const isVercel = process.env.VERCEL === '1';

  if (!isVercel) {
    return path.join(process.cwd(), 'data');
  }

  // Vercel: 必要なファイルをすべて /tmp/data/ へコピーしてからディレクトリを返す
  const tmpDir = '/tmp/data';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const srcDir = path.join(process.cwd(), 'data');
  if (fs.existsSync(srcDir)) {
    for (const file of fs.readdirSync(srcDir)) {
      const dest = path.join(tmpDir, file);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(path.join(srcDir, file), dest);
      }
    }
  }

  return tmpDir;
}
