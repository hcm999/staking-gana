import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, LOCK_DAYS_MAP, getProvider, getContract } from '@/lib/contract';

export async function GET(request: Request) {
  // 验证cron请求
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const provider = getProvider();
    const contract = getContract(provider);
    
    const currentBlock = await provider.getBlockNumber();
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = currentTimestamp - (currentTimestamp % 86400);

    console.log('开始抓取数据...', { 
      currentBlock, 
      currentTimestamp,
      contract: CONTRACT_ADDRESS 
    });

    // 1. 获取各池利率
    for (let poolId = 0; poolId < 3; poolId++) {
      try {
        const ratePerSec = await contract.ratePerSec(poolId);
        const lockDays = LOCK_DAYS_MAP[poolId] || 0;
        
        await sql`
          UPDATE stake_pools 
          SET rate_per_sec = ${ratePerSec.toString()},
              lock_days = ${lockDays},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${poolId}
        `;
        console.log(`池子 ${poolId} 利率更新:`, ratePerSec.toString());
      } catch (e) {
        console.log(`池子 ${poolId} 获取利率失败:`, e);
      }
    }

    // 2. 获取Staked事件（今日新增质押）
    const fromBlock = Math.max(0, currentBlock - 20000); // 最近2万个块
    const stakedFilter = contract.filters.Staked();
    const stakedEvents = await contract.queryFilter(stakedFilter, fromBlock, currentBlock);
    
    let todayNewStake = 0;
    let todayStakeCount = 0;

    for (const event of stakedEvents) {
      const block = await event.getBlock();
      if (block.timestamp >= startOfDay && event.args) {
        const amount = ethers.formatEther(event.args.amount);
        const user = event.args.user;
        const stakeIndex = Number(event.args.index);
        const stakeTime = Number(event.args.stakeTime);
        const lockDays = LOCK_DAYS_MAP[stakeIndex] || 0;
        const unlockTime = stakeTime + lockDays * 86400;
        
        todayNewStake += parseFloat(amount);
        todayStakeCount++;

        // 保存质押记录
        try {
          await sql`
            INSERT INTO stake_records (
              user_address, stake_index, amount, stake_time, 
              stake_timestamp, unlock_time, unlock_timestamp,
              lock_days, tx_hash, block_number, status
            ) VALUES (
              ${user},
              ${stakeIndex},
              ${amount},
              ${stakeTime},
              to_timestamp(${stakeTime}),
              ${unlockTime},
              to_timestamp(${unlockTime}),
              ${lockDays},
              ${event.transactionHash},
              ${event.blockNumber},
              'active'
            )
            ON CONFLICT (tx_hash) DO NOTHING
          `;
        } catch (e) {
          console.log('插入质押记录失败:', e);
        }
      }
    }

    // 3. 获取Unstake事件（今日解押）
    const unstakeFilter = contract.filters.RewardPaid();
    const unstakeEvents = await contract.queryFilter(unstakeFilter, fromBlock, currentBlock);
    
    let todayUnstake = 0;
    let todayUnstakeCount = 0;

    for (const event of unstakeEvents) {
      const block = await event.getBlock();
      if (block.timestamp >= startOfDay && event.args) {
        const reward = ethers.formatEther(event.args.reward);
        const user = event.args.user;
        const index = Number(event.args.index);
        
        todayUnstake += parseFloat(reward);
        todayUnstakeCount++;

        // 更新对应质押记录状态
        await sql`
          UPDATE stake_records 
          SET status = 'unstaked',
              unstake_time = ${block.timestamp},
              unstake_timestamp = to_timestamp(${block.timestamp})
          WHERE user_address = ${user}
            AND stake_index = ${index}
            AND status = 'active'
            AND unlock_time <= ${block.timestamp}
          ORDER BY stake_time ASC
          LIMIT 1
        `;
      }
    }

    // 4. 计算仍在质押的总量
    const activeStakeResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM stake_records
      WHERE status = 'active'
    `;
    const activeStake = parseFloat(activeStakeResult.rows[0]?.total || '0');

    // 5. 计算累计新增质押
    const cumulativeResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM stake_records
    `;
    const cumulativeStake = parseFloat(cumulativeResult.rows[0]?.total || '0');

    // 6. 计算未来可解押金额
    const now = currentTimestamp;
    
    const unlockedNext1DayResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM stake_records
      WHERE status = 'active'
        AND unlock_time BETWEEN ${now} AND ${now + 86400}
    `;
    
    const unlockedNext2DaysResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM stake_records
      WHERE status = 'active'
        AND unlock_time BETWEEN ${now} AND ${now + 2 * 86400}
    `;
    
    const unlockedNext7DaysResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM stake_records
      WHERE status = 'active'
        AND unlock_time BETWEEN ${now} AND ${now + 7 * 86400}
    `;
    
    const unlockedNext15DaysResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM stake_records
      WHERE status = 'active'
        AND unlock_time BETWEEN ${now} AND ${now + 15 * 86400}
    `;
    
    const unlockedNext30DaysResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM stake_records
      WHERE status = 'active'
        AND unlock_time BETWEEN ${now} AND ${now + 30 * 86400}
    `;

    // 7. 统计活跃用户数
    const activeUsersResult = await sql`
      SELECT COUNT(DISTINCT user_address) as count
      FROM stake_records
      WHERE status = 'active'
    `;
    const totalUsers = parseInt(activeUsersResult.rows[0]?.count || '0');

    // 8. 保存每日快照
    await sql`
      INSERT INTO daily_stake_snapshots (
        date, pool_id, new_stake, new_unstake, active_stake, 
        cumulative_stake, total_users,
        unlocked_next_1day, unlocked_next_2days, 
        unlocked_next_7days, unlocked_next_15days, unlocked_next_30days,
        updated_at
      ) VALUES (
        ${today},
        0,
        ${todayNewStake},
        ${todayUnstake},
        ${activeStake},
        ${cumulativeStake},
        ${totalUsers},
        ${parseFloat(unlockedNext1DayResult.rows[0]?.total || '0')},
        ${parseFloat(unlockedNext2DaysResult.rows[0]?.total || '0')},
        ${parseFloat(unlockedNext7DaysResult.rows[0]?.total || '0')},
        ${parseFloat(unlockedNext15DaysResult.rows[0]?.total || '0')},
        ${parseFloat(unlockedNext30DaysResult.rows[0]?.total || '0')},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (date) 
      DO UPDATE SET
        new_stake = EXCLUDED.new_stake,
        new_unstake = EXCLUDED.new_unstake,
        active_stake = EXCLUDED.active_stake,
        cumulative_stake = EXCLUDED.cumulative_stake,
        total_users = EXCLUDED.total_users,
        unlocked_next_1day = EXCLUDED.unlocked_next_1day,
        unlocked_next_2days = EXCLUDED.unlocked_next_2days,
        unlocked_next_7days = EXCLUDED.unlocked_next_7days,
        unlocked_next_15days = EXCLUDED.unlocked_next_15days,
        unlocked_next_30days = EXCLUDED.unlocked_next_30days,
        updated_at = CURRENT_TIMESTAMP
    `;

    // 9. 更新各池总质押量
    for (let poolId = 0; poolId < 3; poolId++) {
      const poolActiveResult = await sql`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM stake_records
        WHERE status = 'active' AND stake_index = ${poolId}
      `;
      
      await sql`
        UPDATE stake_pools 
        SET total_staked = ${parseFloat(poolActiveResult.rows[0]?.total || '0')}
        WHERE id = ${poolId}
      `;
    }

    console.log('数据抓取完成:', {
      today,
      todayNewStake,
      todayUnstake,
      netNewStake: todayNewStake - todayUnstake,
      activeStake,
      cumulativeStake,
      totalUsers
    });

    return NextResponse.json({ 
      success: true, 
      data: {
        today,
        newStake: todayNewStake,
        unstake: todayUnstake,
        netNewStake: todayNewStake - todayUnstake,
        activeStake,
        cumulativeStake,
        totalUsers
      }
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 设置最大执行时间为60秒
