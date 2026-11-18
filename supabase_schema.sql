-- ══════════════════════════════════════════════════
-- 🎓 خشتەکانی سیستەمی پێشبڕکێی شەوانەی پەیمانگا لە Supabase
-- ══════════════════════════════════════════════════
-- تکایە ئەم کۆدە کۆپی بکە و لەناو Supabase بچۆ بەشی "SQL Editor"
-- پاشان لێرە بیپەیستە و دوگمەی "RUN" دابگرە.

-- 1. خشتەی بەکارهێنەران و پاسوۆردی پارێزراو
CREATE TABLE IF NOT EXISTS quiz_users (
    username TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dept TEXT,
    avatar_url TEXT,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. خشتەی پرۆفایلی خوێندکاران و تەلاری پاڵەوانان
CREATE TABLE IF NOT EXISTS quiz_profiles (
    name TEXT PRIMARY KEY,
    username TEXT,
    dept TEXT,
    avatar_url TEXT,
    bio TEXT,
    instagram TEXT,
    telegram TEXT,
    tiktok TEXT,
    facebook TEXT,
    wins INT DEFAULT 0,
    total_games INT DEFAULT 0,
    eliminations INT DEFAULT 0,
    total_correct INT DEFAULT 0,
    total_answered INT DEFAULT 0,
    last_played TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. خشتەی تۆماری ڕاستەوخۆی چوونەژوورەوەی خوێندکاران بۆ ئادمین
CREATE TABLE IF NOT EXISTS quiz_activity_log (
    id TEXT PRIMARY KEY,
    name TEXT,
    username TEXT,
    dept TEXT,
    avatar_url TEXT,
    action_type TEXT,
    action_label TEXT,
    device TEXT,
    time TEXT,
    date TEXT,
    timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. خشتەی پرسیارەکان
CREATE TABLE IF NOT EXISTS quiz_questions (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_index INT NOT NULL,
    time_limit INT DEFAULT 15
);

-- 5. خشتەی ڕێکخستنەکان و دۆخی زیندوو
CREATE TABLE IF NOT EXISTS quiz_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- 6. خشتەی چاتی ڕاستەوخۆی خوێندکاران
CREATE TABLE IF NOT EXISTS quiz_chat (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dept TEXT,
    avatar_url TEXT,
    text TEXT NOT NULL,
    time TEXT,
    timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════
-- کاراکردنی ڕێگەپێدان (Row Level Security - RLS)
-- ══════════════════════════════════════════════════
ALTER TABLE quiz_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access to quiz_users" ON quiz_users;
CREATE POLICY "Public full access to quiz_users" ON quiz_users FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE quiz_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access to quiz_profiles" ON quiz_profiles;
CREATE POLICY "Public full access to quiz_profiles" ON quiz_profiles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE quiz_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access to quiz_activity_log" ON quiz_activity_log;
CREATE POLICY "Public full access to quiz_activity_log" ON quiz_activity_log FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access to quiz_questions" ON quiz_questions;
CREATE POLICY "Public full access to quiz_questions" ON quiz_questions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE quiz_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access to quiz_settings" ON quiz_settings;
CREATE POLICY "Public full access to quiz_settings" ON quiz_settings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE quiz_chat ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access to quiz_chat" ON quiz_chat;
CREATE POLICY "Public full access to quiz_chat" ON quiz_chat FOR ALL USING (true) WITH CHECK (true);
