-- ====================================================================
-- JJA研修システム データベーススキーマ
--
-- 実行方法:
--   1. Supabase ダッシュボード → 左メニュー「SQL Editor」
--   2. 「New query」でこのファイル全体をコピペ
--   3. 「Run」ボタン（または Ctrl+Enter）
--
-- 既存JSONファイルとの整合性のため camelCase 列名を採用しています。
-- 既存JS/JSONをそのまま流用できるようにすることが目的。
-- ====================================================================

-- 既存のテーブルがあれば削除（やり直し時に使用）
DROP TABLE IF EXISTS access_logs CASCADE;
DROP TABLE IF EXISTS records CASCADE;
DROP TABLE IF EXISTS trainees CASCADE;
DROP TABLE IF EXISTS classrooms CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS operators CASCADE;

-- ====================================================================
-- 事業者テーブル
-- ====================================================================
CREATE TABLE operators (
  "operatorCode"  TEXT PRIMARY KEY,
  "companyName"   TEXT NOT NULL,
  "adminPassword" TEXT NOT NULL,           -- 将来ハッシュ化予定
  "contactName"   TEXT DEFAULT '',
  "contactEmail"  TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'active',  -- active / inactive
  "registeredAt"  DATE,
  note            TEXT DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_operators_status ON operators(status);

-- ====================================================================
-- 教室テーブル
-- ====================================================================
CREATE TABLE classrooms (
  "classroomCode"     TEXT PRIMARY KEY,
  "operatorCode"      TEXT NOT NULL REFERENCES operators("operatorCode") ON DELETE CASCADE,
  "classroomName"     TEXT NOT NULL,
  "classroomPassword" TEXT,
  "isHQ"              BOOLEAN NOT NULL DEFAULT FALSE,
  status              TEXT NOT NULL DEFAULT 'active',  -- active / inactive
  "createdAt"         DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_classrooms_operator ON classrooms("operatorCode");
CREATE INDEX idx_classrooms_status ON classrooms(status);

-- ====================================================================
-- 受講者プロファイル（trainees）
-- ====================================================================
CREATE TABLE trainees (
  id                   TEXT PRIMARY KEY,
  "operatorCode"       TEXT NOT NULL,
  "companyName"        TEXT DEFAULT '',
  "classroomCode"      TEXT,
  "classroomName"      TEXT DEFAULT '',
  "fullName"           TEXT NOT NULL,
  track                TEXT NOT NULL DEFAULT 'general',  -- general / manager
  status               TEXT NOT NULL DEFAULT 'active',   -- active / retired / suspended
  "retiredAt"          TIMESTAMPTZ,
  "statusUpdatedAt"    TIMESTAMPTZ,
  notes                TEXT DEFAULT '',
  "registeredAt"       DATE,
  "latestRecordId"     TEXT,
  "videoCompletedAt"   TIMESTAMPTZ,
  "videoIdLastWatched" TEXT,
  "serverFailCount"    INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt"      TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trainees_op_name ON trainees("operatorCode", "fullName");
CREATE INDEX idx_trainees_classroom ON trainees("classroomCode");
CREATE INDEX idx_trainees_status ON trainees(status);

-- ====================================================================
-- 受講記録（records）
-- ====================================================================
CREATE TABLE records (
  id               TEXT PRIMARY KEY,
  "operatorCode"   TEXT NOT NULL,
  "memberCode"     TEXT,
  "classroomCode"  TEXT,
  "companyName"    TEXT DEFAULT '',
  "classroomName"  TEXT DEFAULT '',
  "fullName"       TEXT NOT NULL,
  email            TEXT DEFAULT '',
  track            TEXT NOT NULL DEFAULT 'general',
  score            INTEGER,
  "correctCount"   INTEGER,
  "totalQuestions" INTEGER,
  passed           BOOLEAN NOT NULL DEFAULT FALSE,
  "failCount"      INTEGER DEFAULT 0,
  "completionDate" TEXT,                              -- "2026年5月4日" 形式
  "certNumber"     TEXT,
  answers          JSONB,
  "submittedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_records_op ON records("operatorCode");
CREATE INDEX idx_records_classroom ON records("classroomCode");
CREATE INDEX idx_records_passed ON records(passed);
CREATE INDEX idx_records_op_name ON records("operatorCode", "fullName");

-- ====================================================================
-- アクセスログ
-- ====================================================================
CREATE TABLE access_logs (
  id          BIGSERIAL PRIMARY KEY,
  type        TEXT NOT NULL,                  -- admin / operator / classroom
  target      TEXT NOT NULL,
  result      TEXT NOT NULL,                  -- success / fail
  reason      TEXT DEFAULT '',
  ip          TEXT DEFAULT '',
  user_agent  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_access_logs_type ON access_logs(type);
CREATE INDEX idx_access_logs_created ON access_logs(created_at DESC);

-- ====================================================================
-- 会員テーブル（旧仕様の互換性用・将来削除予定）
-- ====================================================================
CREATE TABLE members (
  "memberCode"  TEXT PRIMARY KEY,
  "companyName" TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- updated_at 自動更新トリガー
-- ====================================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_operators_updated_at  BEFORE UPDATE ON operators
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_classrooms_updated_at BEFORE UPDATE ON classrooms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_trainees_updated_at   BEFORE UPDATE ON trainees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ====================================================================
-- Row Level Security（RLS）
--   - すべてのテーブルでRLSを有効化
--   - サーバー側API（service_role使用）のみアクセス可
--   - クライアント側からの直接アクセスはデフォルトで拒否
-- ====================================================================
ALTER TABLE operators    ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms   ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainees     ENABLE ROW LEVEL SECURITY;
ALTER TABLE records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE members      ENABLE ROW LEVEL SECURITY;

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE '✅ JJA研修システム スキーマ作成完了';
END $$;
