
import React, { useEffect, useState, useCallback } from 'react';
import { CryptoPrice } from '../types';

const COIN_IDS = 'bitcoin,ethereum,solana,binancecoin,ripple,dogecoin,cardano,avalanche-2,chainlink,polkadot';

const CryptoTicker: React.FC = () => {
  const [prices, setPrices] = useState<CryptoPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrices = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS}&order=market_cap_desc&per_page=10&page=1&sparkline=false`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );
      
      if (response.status === 429) {
        throw new Error("API 请求频率过快，请稍后再试");
      }

      if (!response.ok) {
        throw new Error("无法获取实时行情");
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setPrices(data);
        setLastUpdated(new Date());
      } else {
        throw new Error("数据格式错误");
      }
    } catch (error: any) {
      console.error("Fetch prices failed:", error);
      setError(error.message || "行情服务暂不可用");
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    fetchPrices();
    // 降低刷新频率，避免触发 429
    const interval = setInterval(fetchPrices, 120000); 
    return () => clearInterval(interval);
  }, [fetchPrices]);

  return (
    <div className="w-full bg-crypto-card border-b border-gray-700 p-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
      <div className="flex items-center space-x-6 px-4">
        <button 
          onClick={fetchPrices}
          disabled={loading}
          className={`text-xs font-bold px-2 py-1 rounded transition-all ${loading ? 'text-gray-500 cursor-not-allowed' : 'text-crypto-accent hover:bg-crypto-accent/10 underline'}`}
        >
          {loading ? '更新中...' : '刷新行情'}
        </button>

        {error ? (
          <span className="text-xs text-crypto-down font-medium italic">
            {error} (点击左侧重试)
          </span>
        ) : prices.length > 0 ? (
          prices.map((coin) => (
            <div key={coin.id} className="flex items-center space-x-2 text-sm">
              <span className="font-bold text-gray-300 uppercase">{coin.symbol}</span>
              <span className="text-white font-mono">${coin.current_price?.toLocaleString()}</span>
              <span className={`font-mono text-xs ${coin.price_change_percentage_24h >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                {coin.price_change_percentage_24h >= 0 ? '+' : ''}{coin.price_change_percentage_24h?.toFixed(2)}%
              </span>
            </div>
          ))
        ) : !loading && (
          <span className="text-xs text-gray-500 italic">暂无行情数据</span>
        )}
        
        {lastUpdated && !error && (
          <span className="text-[10px] text-gray-500 ml-auto block">
            Last: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
};

export default CryptoTicker;
