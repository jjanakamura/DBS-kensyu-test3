import crypto from 'crypto';
import { getOperator, getClassroom } from './db';

/**
 * 認証ユーティリティ（HMAC ベースのステートレストークン）
 *
 * 仕組み：
 *   token = HMAC-SHA256(secret, 現在の時間単位)
 *   有効期限：最大 2 時間（現在時刻 ± 1 時間のウィンドウ）
 *   サーバー側にセッション保持が不要（Vercel Serverless に最適）
 *
 * スコープ：
 *   admin     → ADMIN_PASSWORD 由来のトークン
 *   operator  → 事業者の adminPassword 由来のトークン
 *   classroom → 教室の classroomPassword 由来のトークン
 */

function makeToken(secret) {
  const hour = Math.floor(Date.now() / 3_600_000);
  return crypto.createHmac('sha256', String(secret)).update(String(hour)).digest('hex');
}

function checkToken(token, secret) {
  if (!token || !secret) return false;
  const hour = Math.floor(Date.now() / 3_600_000);
  for (let i = 0; i <= 1; i++) {
    const valid = crypto
      .createHmac('sha256', String(secret))
      .update(String(hour - i))
      .digest('hex');
    if (token === valid) return true;
  }
  return false;
}

// ─── 管理者 ────────────────────────────────────────────────────────
/**
 * ⚠ ADMIN_PASSWORD は必ず環境変数で設定すること（コード内フォールバック禁止）
 *    Vercel: Settings → Environment Variables → ADMIN_PASSWORD
 *    ローカル: .env.local に ADMIN_PASSWORD=... を記述
 */
function getAdminSecret() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    // ログには値を出さない。原因のみ。
    console.error('[auth] ADMIN_PASSWORD が未設定です。管理者ログインを拒否します。');
    return null;
  }
  return pw;
}

export function generateAdminToken() {
  const secret = getAdminSecret();
  if (!secret) return null;
  return makeToken(secret);
}

export function verifyAdminToken(token) {
  const secret = getAdminSecret();
  if (!secret) return false;
  return checkToken(token, secret);
}

// ─── 事業者 ────────────────────────────────────────────────────────
export function generateOperatorToken(adminPassword) {
  return makeToken(adminPassword);
}

export async function verifyOperatorToken(token, operatorCode) {
  if (!token || !operatorCode) return false;
  try {
    const op = await getOperator(operatorCode);
    return op?.adminPassword ? checkToken(token, op.adminPassword) : false;
  } catch {
    return false;
  }
}

// ─── 教室 ──────────────────────────────────────────────────────────
export function generateClassroomToken(classroomPassword) {
  return makeToken(classroomPassword);
}

/**
 * 教室トークンを検証し、所属 operatorCode を返す
 * @returns {Promise<string|null>} operatorCode（検証失敗時は null）
 */
export async function verifyClassroomToken(token, classroomCode) {
  if (!token || !classroomCode) return null;
  try {
    const c = await getClassroom(classroomCode);
    if (!c) return null;
    const pw = c.classroomPassword || c.classroomCode;
    return checkToken(token, pw) ? String(c.operatorCode).toUpperCase() : null;
  } catch {
    return null;
  }
}

// ─── 統合スコープ解決 ──────────────────────────────────────────────
/**
 * リクエストヘッダーから認証スコープを解決する
 *
 * リクエストヘッダー:
 *   管理者   : x-admin-token
 *   事業者   : x-operator-token + x-operator-code
 *   教室     : x-classroom-token + x-classroom-code
 *
 * @returns {{ scope: 'admin'|'operator'|'classroom', operatorCode: string|null, classroomCode: string|null } | null}
 *   null の場合はすでに 401 レスポンスを返済み
 */
export async function getAuthScope(req, res) {
  // 管理者
  const adminToken = req.headers['x-admin-token'] || '';
  if (adminToken && verifyAdminToken(adminToken)) {
    return { scope: 'admin', operatorCode: null, classroomCode: null };
  }

  // 事業者
  const opToken = req.headers['x-operator-token'] || '';
  const opCode  = req.headers['x-operator-code']  || '';
  if (opToken && opCode && (await verifyOperatorToken(opToken, opCode))) {
    return {
      scope: 'operator',
      operatorCode: String(opCode).toUpperCase(),
      classroomCode: null,
    };
  }

  // 教室
  const clsToken = req.headers['x-classroom-token'] || '';
  const clsCode  = req.headers['x-classroom-code']  || '';
  if (clsToken && clsCode) {
    const opCodeFromCls = await verifyClassroomToken(clsToken, clsCode);
    if (opCodeFromCls) {
      return {
        scope: 'classroom',
        operatorCode: opCodeFromCls,
        classroomCode: String(clsCode).toUpperCase(),
      };
    }
  }

  res.status(401).json({ error: '認証が必要です。ログインし直してください。' });
  return null;
}

/**
 * 管理者専用エンドポイント用ショートハンド
 * @returns {boolean} 認証成功なら true、失敗なら false（401 返済み）
 */
export function requireAdmin(req, res) {
  const token = req.headers['x-admin-token'] || '';
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: '管理者認証が必要です。管理画面からログインし直してください。' });
    return false;
  }
  return true;
}
