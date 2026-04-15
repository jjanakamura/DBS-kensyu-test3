import crypto from 'crypto';
import fs from 'fs';
import { getDataPath } from './dataPath';

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
export function generateAdminToken() {
  return makeToken(process.env.ADMIN_PASSWORD || 'admin2024');
}

export function verifyAdminToken(token) {
  return checkToken(token, process.env.ADMIN_PASSWORD || 'admin2024');
}

// ─── 事業者 ────────────────────────────────────────────────────────
export function generateOperatorToken(adminPassword) {
  return makeToken(adminPassword);
}

export function verifyOperatorToken(token, operatorCode) {
  if (!token || !operatorCode) return false;
  try {
    const ops = JSON.parse(fs.readFileSync(getDataPath('operators.json'), 'utf-8') || '[]');
    const op = ops.find(
      (o) => o.operatorCode?.toUpperCase() === String(operatorCode).toUpperCase()
    );
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
 * @returns {string|null} operatorCode（検証失敗時は null）
 */
export function verifyClassroomToken(token, classroomCode) {
  if (!token || !classroomCode) return null;
  try {
    const cls = JSON.parse(fs.readFileSync(getDataPath('classrooms.json'), 'utf-8') || '[]');
    const c = cls.find(
      (c) => c.classroomCode?.toUpperCase() === String(classroomCode).toUpperCase()
    );
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
export function getAuthScope(req, res) {
  // 管理者
  const adminToken = req.headers['x-admin-token'] || '';
  if (adminToken && verifyAdminToken(adminToken)) {
    return { scope: 'admin', operatorCode: null, classroomCode: null };
  }

  // 事業者
  const opToken = req.headers['x-operator-token'] || '';
  const opCode  = req.headers['x-operator-code']  || '';
  if (opToken && opCode && verifyOperatorToken(opToken, opCode)) {
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
    const opCodeFromCls = verifyClassroomToken(clsToken, clsCode);
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
