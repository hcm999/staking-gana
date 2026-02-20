import { sql } from '@vercel/postgres';

export interface DailySnapshot {
  date: string;
  newStake: number;
  newUnstake: number;
  activeStake: number;
  cumulativeStake: number;
  totalUsers: number;
  unlockedNext1Day: number;
  unlockedNext2Days: number;
  unlockedNext7Days: number;
  unlockedNext15Days: number;
  unlockedNext30Days: number;
}

export interface PoolInfo {
  id: number;
  lockDays: number;
  apy: string;
  totalStaked: number;
  ratePerSec: string;
}

export async function getDailySnapshots(days: number): Promise<DailySnapshot[]> {
  const result = await sql`
    SELECT 
      date,
      new_stake,
      new_unstake,
      active_stake,
      cumulative_stake,
      total_users,
      unlocked_next_1day,
      unlocked_next_2days,
      unlocked_next_7days,
      unlocked_next_15days,
      unlocked_next_30days
    FROM daily_stake_snapshots
    WHERE date >= CURRENT_DATE - (${days} || ' days')::INTERVAL
    ORDER BY date ASC
  `;
  
  return result.rows.map(row => ({
    date: row.date,
    newStake: parseFloat(row.new_stake || '0'),
    newUnstake: parseFloat(row.new_unstake || '0'),
    activeStake: parseFloat(row.active_stake || '0'),
    cumulativeStake: parseFloat(row.cumulative_stake || '0'),
    totalUsers: parseInt(row.total_users || '0'),
    unlockedNext1Day: parseFloat(row.unlocked_next_1day || '0'),
    unlockedNext2Days: parseFloat(row.unlocked_next_2days || '0'),
    unlockedNext7Days: parseFloat(row.unlocked_next_7days || '0'),
    unlockedNext15Days: parseFloat(row.unlocked_next_15days || '0'),
    unlockedNext30Days: parseFloat(row.unlocked_next_30days || '0'),
  }));
}

export async function getPools(): Promise<PoolInfo[]> {
  const result = await sql`
    SELECT * FROM stake_pools ORDER BY id
  `;
  
  return result.rows.map(row => ({
    id: row.id,
    lockDays: row.lock_days,
    apy: (parseFloat(row.apy) || 0).toFixed(2) + '%',
    totalStaked: parseFloat(row.total_staked || '0'),
    ratePerSec: row.rate_per_sec
  }));
}

export async function getLatestStats() {
  const result = await sql`
    SELECT 
      cumulative_stake,
      active_stake,
      total_users,
      unlocked_next_1day,
      unlocked_next_2days,
      unlocked_next_7days,
      unlocked_next_15days,
      unlocked_next_30days
    FROM daily_stake_snapshots
    ORDER BY date DESC
    LIMIT 1
  `;
  
  if (result.rows.length === 0) {
    return {
      cumulativeStake: 0,
      activeStake: 0,
      totalUsers: 0,
      unlockedNext1Day: 0,
      unlockedNext2Days: 0,
      unlockedNext7Days: 0,
      unlockedNext15Days: 0,
      unlockedNext30Days: 0
    };
  }
  
  const row = result.rows[0];
  return {
    cumulativeStake: parseFloat(row.cumulative_stake || '0'),
    activeStake: parseFloat(row.active_stake || '0'),
    totalUsers: parseInt(row.total_users || '0'),
    unlockedNext1Day: parseFloat(row.unlocked_next_1day || '0'),
    unlockedNext2Days: parseFloat(row.unlocked_next_2days || '0'),
    unlockedNext7Days: parseFloat(row.unlocked_next_7days || '0'),
    unlockedNext15Days: parseFloat(row.unlocked_next_15days || '0'),
    unlockedNext30Days: parseFloat(row.unlocked_next_30days || '0')
  };
}
