-- 创建质押池配置表
CREATE TABLE IF NOT EXISTS stake_pools (
  id INTEGER PRIMARY KEY,
  lock_days INTEGER NOT NULL,
  rate_per_sec DECIMAL(30, 18) NOT NULL,
  min_stake DECIMAL(20, 2) NOT NULL,
  max_stake DECIMAL(20, 2) NOT NULL,
  total_staked DECIMAL(30, 2) DEFAULT 0,
  apy DECIMAL(10, 2) GENERATED ALWAYS AS (rate_per_sec * 365 * 24 * 60 * 60 * 100) STORED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建质押记录表
CREATE TABLE IF NOT EXISTS stake_records (
  id SERIAL PRIMARY KEY,
  user_address VARCHAR(42) NOT NULL,
  stake_index INTEGER NOT NULL,
  amount DECIMAL(30, 2) NOT NULL,
  stake_time BIGINT NOT NULL,
  stake_timestamp TIMESTAMP,
  unlock_time BIGINT NOT NULL,
  unlock_timestamp TIMESTAMP,
  lock_days INTEGER NOT NULL,
  status VARCHAR(10) DEFAULT 'active',
  unstake_time BIGINT,
  unstake_timestamp TIMESTAMP,
  tx_hash VARCHAR(66) UNIQUE,
  block_number INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建每日快照表
CREATE TABLE IF NOT EXISTS daily_stake_snapshots (
  date DATE PRIMARY KEY,
  pool_id INTEGER NOT NULL DEFAULT 0,
  new_stake DECIMAL(20, 2) NOT NULL DEFAULT 0,
  new_unstake DECIMAL(20, 2) NOT NULL DEFAULT 0,
  active_stake DECIMAL(20, 2) NOT NULL DEFAULT 0,
  cumulative_stake DECIMAL(30, 2) NOT NULL DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  unlocked_next_1day DECIMAL(20, 2) DEFAULT 0,
  unlocked_next_2days DECIMAL(20, 2) DEFAULT 0,
  unlocked_next_7days DECIMAL(20, 2) DEFAULT 0,
  unlocked_next_15days DECIMAL(20, 2) DEFAULT 0,
  unlocked_next_30days DECIMAL(20, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_stake_records_user ON stake_records(user_address);
CREATE INDEX IF NOT EXISTS idx_stake_records_unlock ON stake_records(unlock_time) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_stake_records_status ON stake_records(status);
CREATE INDEX IF NOT EXISTS idx_stake_records_stake_time ON stake_records(stake_time);

-- 初始化质押池数据
INSERT INTO stake_pools (id, lock_days, rate_per_sec, min_stake, max_stake)
VALUES 
  (0, 1, 0.000000000000000001, 100, 1000000),
  (1, 15, 0.000000000000000002, 100, 1000000),
  (2, 30, 0.000000000000000003, 100, 1000000)
ON CONFLICT (id) DO NOTHING;
