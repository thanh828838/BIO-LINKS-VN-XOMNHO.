-- ============================================================
-- Xn Bio Links — Database schema (PostgreSQL)
-- Import:  psql -U postgres -d xnbiolinks -f database/schema.sql
-- ============================================================

-- Tạo database nếu chưa có (chạy tay nếu cần):
-- CREATE DATABASE xnbiolinks;

-- ============================================================
-- users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id                SERIAL PRIMARY KEY,
    username          VARCHAR(20)  NOT NULL UNIQUE,
    email             VARCHAR(255) NOT NULL UNIQUE,
    password_hash     VARCHAR(255) NOT NULL,
    terms_accepted    BOOLEAN      NOT NULL DEFAULT FALSE,
    privacy_accepted  BOOLEAN      NOT NULL DEFAULT FALSE,
    legal_accepted_at TIMESTAMPTZ,
    legal_version     VARCHAR(10)  NOT NULL DEFAULT '1.0',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- ============================================================
-- profiles — 1-1 với users
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER     NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    display_name VARCHAR(40) NOT NULL DEFAULT '',
    bio          VARCHAR(140) NOT NULL DEFAULT '',
    avatar_url   TEXT        NOT NULL DEFAULT '',
    background   VARCHAR(20) NOT NULL DEFAULT 'mist',
    accent_color VARCHAR(9)  NOT NULL DEFAULT '#0EA5E9',
    button_style VARCHAR(10) NOT NULL DEFAULT 'fill',
    font         VARCHAR(10) NOT NULL DEFAULT 'sans',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- links — liên kết trên trang công khai
-- ============================================================
CREATE TABLE IF NOT EXISTS links (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title      VARCHAR(60)  NOT NULL,
    url        TEXT         NOT NULL,
    icon       VARCHAR(20)  NOT NULL DEFAULT 'link',
    position   INTEGER      NOT NULL DEFAULT 0,
    enabled    BOOLEAN      NOT NULL DEFAULT TRUE,
    clicks     INTEGER      NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_links_user ON links (user_id, position);

-- ============================================================
-- social_links — hàng icon mạng xã hội
-- ============================================================
CREATE TABLE IF NOT EXISTS social_links (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    platform   VARCHAR(20)  NOT NULL,
    url        TEXT         NOT NULL,
    position   INTEGER      NOT NULL DEFAULT 0,
    enabled    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),

    UNIQUE (user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_social_links_user ON social_links (user_id, position);

-- ============================================================
-- sessions — phiên đăng nhập (httpOnly cookie)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    id         VARCHAR(64) PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

-- ============================================================
-- page_views — lượt xem trang công khai (tổng + lịch sử 7 ngày)
-- ============================================================
CREATE TABLE IF NOT EXISTS page_views (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    day        DATE         NOT NULL,
    views      INTEGER      NOT NULL DEFAULT 0,

    UNIQUE (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_page_views_user ON page_views (user_id, day DESC);

-- ============================================================
-- short_links — rút gọn đường dẫn
-- ============================================================
CREATE TABLE IF NOT EXISTS short_links (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    slug         VARCHAR(16)  NOT NULL UNIQUE,
    original_url TEXT         NOT NULL,
    title        VARCHAR(60)  NOT NULL DEFAULT '',
    clicks       INTEGER      NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_short_links_user ON short_links (user_id, created_at DESC);

-- ============================================================
-- visits — log lượt truy cập trang công khai (phân tích)
-- ============================================================
CREATE TABLE IF NOT EXISTS visits (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    visitor_id VARCHAR(40)  NOT NULL,
    device     VARCHAR(10)  NOT NULL DEFAULT 'desktop',
    referrer   VARCHAR(120) NOT NULL DEFAULT '(trực tiếp)',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_user ON visits (user_id, created_at DESC);

-- ============================================================
-- click_logs — log lượt nhấp (bio link + short link)
-- ============================================================
CREATE TABLE IF NOT EXISTS click_logs (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    link_id    INTEGER      REFERENCES links (id) ON DELETE SET NULL,
    short_id   INTEGER      REFERENCES short_links (id) ON DELETE SET NULL,
    label      VARCHAR(80)  NOT NULL DEFAULT '',
    visitor_id VARCHAR(40)  NOT NULL DEFAULT '',
    device     VARCHAR(10)  NOT NULL DEFAULT 'desktop',
    referrer   VARCHAR(120) NOT NULL DEFAULT '(trực tiếp)',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_click_logs_user ON click_logs (user_id, created_at DESC);

-- ============================================================
-- user_prefs — tuỳ chọn thông báo / quyền riêng tư
-- ============================================================
CREATE TABLE IF NOT EXISTS user_prefs (
    user_id    INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    prefs      JSONB       NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- bug_reports — báo lỗi từ người dùng
-- ============================================================
CREATE TABLE IF NOT EXISTS bug_reports (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER      REFERENCES users (id) ON DELETE SET NULL,
    name        VARCHAR(60)  NOT NULL,
    email       VARCHAR(255) NOT NULL,
    type        VARCHAR(20)  NOT NULL,
    description TEXT         NOT NULL,
    page_url    VARCHAR(500) NOT NULL DEFAULT '',
    status      VARCHAR(10)  NOT NULL DEFAULT 'new',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_created ON bug_reports (created_at DESC);
