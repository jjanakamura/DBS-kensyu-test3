/**
 * Supabase クライアント
 *
 * - サーバー側API（pages/api/）からは supabaseAdmin を使用（全権限のSecret key）
 * - クライアント側で直接DBに触ることは原則しない（API経由）
 *
 * Supabase 新キー仕様：
 *   - Publishable key (sb_publishable_xxx) ：クライアント側でも公開可
 *   - Secret key       (sb_secret_xxx)     ：サーバー側のみ・全権限
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL) {
  console.error('[supabase] NEXT_PUBLIC_SUPABASE_URL が未設定です。');
}

/**
 * サーバーサイド専用クライアント（全権限）
 * pages/api/** からのみ使用すること
 */
export const supabaseAdmin = SUPABASE_URL && SECRET_KEY
  ? createClient(SUPABASE_URL, SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'public' },
    })
  : null;

/**
 * クライアントサイド用（公開キー）
 * 必要なら React コンポーネントから利用
 */
export const supabasePublic = SUPABASE_URL && PUBLISHABLE_KEY
  ? createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
      auth: { persistSession: false },
    })
  : null;
