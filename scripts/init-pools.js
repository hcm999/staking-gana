// scripts/init-pools.js
const { sql } = require('@vercel/postgres');

async function initPools() {
  try {
    // 初始化质押池配置
    const pools = [
      { id: 0, lock_days: 1, rate_per_sec: '0.000000000000000001', min_stake: 100, max_stake: 1000000 },
      { id: 1, lock_days: 15, rate_per_sec: '0.000000000000000002', min_stake: 100, max_stake: 1000000 },
      { id: 2, lock_days: 30, rate_per_sec: '0.000000000000000003', min_stake: 100, max_stake: 1000000 }
    ];

    for (const pool of pools) {
      await sql`
        INSERT INTO stake_pools (id, lock_days, rate_per_sec, min_stake, max_stake)
        VALUES (${pool.id}, ${pool.lock_days}, ${pool.rate_per_sec}, ${pool.min_stake}, ${pool.max_stake})
        ON CONFLICT (id) DO UPDATE SET
          lock_days = EXCLUDED.lock_days,
          rate_per_sec = EXCLUDED.rate_per_sec,
          updated_at = CURRENT_TIMESTAMP
      `;
      console.log(`池子 ${pool.id} 初始化完成`);
    }

    console.log('所有质押池初始化完成');
  } catch (error) {
    console.error('初始化失败:', error);
  }
}

initPools();
