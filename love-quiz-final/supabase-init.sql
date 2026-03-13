-- =============================================
-- 恋爱星球测试 v4 · IP限制表
-- 在 Supabase → SQL Editor → New Query 执行
-- =============================================

-- IP 使用记录表
CREATE TABLE IF NOT EXISTS ip_usage (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip           TEXT NOT NULL UNIQUE,
  used_count   INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_usage_ip ON ip_usage(ip);

ALTER TABLE ip_usage DISABLE ROW LEVEL SECURITY;

-- 查看所有IP使用情况
-- SELECT ip, used_count, last_used_at FROM ip_usage ORDER BY last_used_at DESC;

-- 重置某个IP（如需手动重置）
-- UPDATE ip_usage SET used_count = 0 WHERE ip = '1.2.3.4';

-- 清空所有记录（慎用）
-- TRUNCATE ip_usage;
