// api/proxy.js - RPC代理，解决CORS和限流问题
const RPC_NODES = [
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org',
  'https://bsc-dataseed3.binance.org',
  'https://bsc-dataseed4.binance.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed2.defibit.io',
  'https://bsc-dataseed1.ninicoin.io',
  'https://bsc-dataseed2.ninicoin.io'
];

// 简单的内存缓存
const cache = new Map();
const CACHE_TTL = 30000; // 30秒缓存

// 获取随机节点（带权重，避免单节点过载）
function getRandomNode() {
  return RPC_NODES[Math.floor(Math.random() * RPC_NODES.length)];
}

// 带超时的fetch
async function fetchWithTimeout(url, options, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 只允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  
  try {
    const { method, params, id = 1 } = req.body;
    
    // 生成缓存键（只缓存eth_call和eth_getLogs）
    const cacheKey = `${method}_${JSON.stringify(params)}`;
    
    // 检查缓存（只对读操作缓存）
    if (method === 'eth_call' || method === 'eth_getLogs' || method === 'eth_getBlockByNumber') {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[代理] 缓存命中: ${method}`);
        return res.status(200).json(cached.data);
      }
    }

    // 选择节点
    const rpcUrl = getRandomNode();
    console.log(`[代理] 使用节点: ${rpcUrl}, 方法: ${method}`);

    // 发送RPC请求
    const response = await fetchWithTimeout(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id
      })
    });

    const data = await response.json();
    
    // 检查是否有错误
    if (data.error) {
      console.error(`[代理] RPC错误 (${rpcUrl}):`, data.error);
      
      // 如果是限流错误，尝试使用另一个节点重试一次
      if (data.error.message?.includes('limit') || 
          data.error.message?.includes('exceeded') || 
          data.error.message?.includes('timeout')) {
        
        console.log('[代理] 遇到限流，尝试另一个节点...');
        const retryUrl = getRandomNode();
        
        try {
          const retryResponse = await fetchWithTimeout(retryUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method,
              params,
              id
            })
          });
          
          const retryData = await retryResponse.json();
          
          // 重试成功，可以缓存
          if (!retryData.error && (method === 'eth_call' || method === 'eth_getLogs')) {
            cache.set(cacheKey, {
              data: retryData,
              timestamp: Date.now()
            });
          }
          
          console.log(`[代理] 重试成功，耗时: ${Date.now() - startTime}ms`);
          return res.status(200).json(retryData);
          
        } catch (retryError) {
          console.error('[代理] 重试也失败:', retryError);
        }
      }
      
      return res.status(500).json({ 
        error: 'RPC错误',
        message: data.error.message,
        code: data.error.code
      });
    }

    // 可以缓存的请求存入缓存
    if (method === 'eth_call' || method === 'eth_getLogs') {
      cache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });
    }

    console.log(`[代理] 成功，耗时: ${Date.now() - startTime}ms`);
    res.status(200).json(data);
    
  } catch (error) {
    console.error('[代理] 请求失败:', error);
    
    // 判断错误类型
    let statusCode = 500;
    let errorMessage = error.message;
    
    if (error.name === 'AbortError') {
      statusCode = 504;
      errorMessage = 'RPC请求超时';
    } else if (error.message.includes('fetch')) {
      statusCode = 503;
      errorMessage = '网络连接失败';
    }
    
    res.status(statusCode).json({ 
      error: 'RPC代理请求失败',
      message: errorMessage
    });
  }
}
