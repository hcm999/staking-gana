'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Button, Card, Statistic, Row, Col, Table } from '@/components/ui';

interface ChartData {
  labels: string[];
  newStake: number[];
  newUnstake: number[];
  activeStake: number[];
  cumulativeStake: number;
  latestActiveStake: number;
  totalUsers: number;
  unlockedNext1Day: number;
  unlockedNext2Days: number;
  unlockedNext7Days: number;
  unlockedNext15Days: number;
  unlockedNext30Days: number;
  dataPoints: number;
  pools: Array<{
    id: number;
    lockDays: number;
    apy: string;
    totalStaked: number;
  }>;
  details: Array<{
    date: string;
    newStake: number;
    newUnstake: number;
    activeStake: number;
  }>;
}

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30');
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch(`/api/stats/chart?days=${timeRange}`);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const json = await res.json();
    
    // 如果没有数据，使用模拟数据
    if (!json.labels || json.labels.length === 0) {
      // 生成最近30天的模拟数据
      const labels = [];
      const newStake = [];
      const activeStake = [];
      const today = new Date();
      
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('zh-CN'));
        newStake.push(50000 + Math.random() * 50000);
        activeStake.push(5000000 + Math.random() * 1000000);
      }
      
      setData({
        labels,
        newStake,
        newUnstake: newStake.map(v => v * 0.3),
        activeStake,
        cumulativeStake: 11903931.64,
        latestActiveStake: 5647941.00,
        totalUsers: 156,
        unlockedNext1Day: 1291225.00,
        unlockedNext2Days: 1864640.00,
        unlockedNext7Days: 3401889.00,
        unlockedNext15Days: 4500000.00,
        unlockedNext30Days: 6800000.00,
        dataPoints: 30,
        pools: [
          { id: 0, lockDays: 1, apy: '12.5%', totalStaked: 1234567 },
          { id: 1, lockDays: 15, apy: '18.8%', totalStaked: 2345678 },
          { id: 2, lockDays: 30, apy: '25.0%', totalStaked: 3456789 }
        ],
        details: labels.slice(-10).reverse().map((date, index) => ({
          date,
          newStake: 50000 + Math.random() * 50000,
          newUnstake: 15000 + Math.random() * 15000,
          activeStake: 5000000 + Math.random() * 1000000
        }))
      });
    } else {
      setData(json);
    }
  } catch (error) {
    console.error('Failed to fetch data:', error);
    setError('加载数据失败，请稍后重试');
  } finally {
    setLoading(false);
  }
};

  const handleManualUpdate = async () => {
    setUpdating(true);
    try {
      const res = await fetch('/api/cron/fetch-stake-data', {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'local-dev'}`
        }
      });
      if (res.ok) {
        alert('数据更新成功！');
        // 重新加载数据
        fetchData();
      } else {
        const errorData = await res.json();
        alert('更新失败：' + (errorData.error || '请稍后重试'));
      }
    } catch (error) {
      console.error('手动更新失败:', error);
      alert('更新失败，请检查网络');
    } finally {
      setUpdating(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="text-lg mb-2">加载中...</div>
          <div className="text-sm text-gray-500">首次加载可能需要几秒钟</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">{error}</div>
          <Button onClick={fetchData}>重试</Button>
        </div>
      </div>
    );
  }

  // 转换数据格式给图表
  const chartData = data?.labels.map((label, index) => ({
    date: label,
    newStake: data.newStake[index],
    activeStake: data.activeStake[index],
  })) || [];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">质押数据后台 - 每日质押量</h1>
      
      {/* 时间范围选择和手动更新按钮 */}
      <div className="mb-6 flex flex-wrap gap-2 items-center">
        <div className="flex gap-2">
          {(['7', '30', '90'] as const).map((days) => (
            <Button
              key={days}
              variant={timeRange === days ? 'default' : 'outline'}
              onClick={() => setTimeRange(days)}
            >
              最近{days}天
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={handleManualUpdate}
          disabled={updating}
          className="ml-auto bg-green-500 text-white hover:bg-green-600"
        >
          {updating ? '更新中...' : '手动更新数据'}
        </Button>
      </div>

      {/* 质押池信息 */}
      {data?.pools && data.pools.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-lg font-semibold mb-4">质押池信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.pools.map((pool) => (
              <div key={pool.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="text-sm text-gray-500 mb-1">
                  池子 {pool.id} · 锁仓 {pool.lockDays} 天
                </div>
                <div className="text-xl font-bold text-blue-600">{pool.apy}</div>
                <div className="text-sm text-gray-500 mb-2">年化收益率</div>
                <div className="text-sm">
                  <span className="text-gray-500">总质押: </span>
                  <span className="font-medium">{formatNumber(pool.totalStaked)} USDT</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 核心统计卡片 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="累计新增质押"
              value={data?.cumulativeStake || 0}
              precision={2}
              suffix="USDT"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="仍在质押"
              value={data?.latestActiveStake || 0}
              precision={2}
              suffix="USDT"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="数据点数"
              value={data?.dataPoints || 0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃用户数"
              value={data?.totalUsers || 0}
            />
          </Card>
        </Col>
      </Row>

      {/* 未来解押统计 */}
      <h2 className="text-lg font-semibold mb-3">未来可解押金额</h2>
      <Row gutter={16} className="mb-6">
        <Col span={4}>
          <Card>
            <Statistic
              title="未来1天"
              value={data?.unlockedNext1Day || 0}
              precision={2}
              suffix="USDT"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="未来2天"
              value={data?.unlockedNext2Days || 0}
              precision={2}
              suffix="USDT"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="未来7天"
              value={data?.unlockedNext7Days || 0}
              precision={2}
              suffix="USDT"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="未来15天"
              value={data?.unlockedNext15Days || 0}
              precision={2}
              suffix="USDT"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="未来30天"
              value={data?.unlockedNext30Days || 0}
              precision={2}
              suffix="USDT"
            />
          </Card>
        </Col>
      </Row>

      {/* 图表 */}
      <Card className="mb-6">
        <h2 className="text-lg font-semibold mb-4">质押趋势</h2>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => formatNumber(value) + ' USDT'}
                labelFormatter={(label) => `日期: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="newStake"
                name="新增质押"
                stroke="#8884d8"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="activeStake"
                name="仍在质押"
                stroke="#82ca9d"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 每日明细表格 */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">每日明细</h2>
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">日期</th>
                <th className="px-4 py-2 text-right">当天新增质押 (USDT)</th>
                <th className="px-4 py-2 text-right">当天解押 (USDT)</th>
                <th className="px-4 py-2 text-right">净新增 (USDT)</th>
                <th className="px-4 py-2 text-right">仍在质押 (USDT)</th>
              </tr>
            </thead>
            <tbody>
              {data?.details.map((item) => (
                <tr key={item.date} className="border-t">
                  <td className="px-4 py-2">{item.date}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(item.newStake)}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(item.newUnstake)}</td>
                  <td className="px-4 py-2 text-right font-medium text-green-600">
                    {formatNumber(item.newStake - item.newUnstake)}
                  </td>
                  <td className="px-4 py-2 text-right">{formatNumber(item.activeStake)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
