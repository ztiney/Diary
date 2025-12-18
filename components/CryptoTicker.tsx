
import React, { useEffect, useState, useCallback } from 'react';
import { CryptoPrice } from '../types';

const COIN_IDS = 'bitcoin,ethereum,solana,binancecoin,ripple,dogecoin,cardano,avalanche-2,chainlink,polkadot,tron,matic-network';

const CryptoTicker: React.FC = () => {
  const [prices, setPrices] = useState<CryptoPrice[]>([]);
  const [lastFetchSuccessful, setLastFetchSuccessful] = useState(true);

  const fetchPrices = useCallback(async () => {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS}&order=market_cap_desc&per_page=12&page=1&sparkline=false`,
        {
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (response.status === 429) {
        console.warn("CoinGecko API rate limit reached (429). Waiting for next cycle.");
        setLastFetchSuccessful(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setPrices(data);
        setLastFetchSuccessful(true);
      }
    } catch (error) {
      console.warn("CryptoTicker: 行情获取失败 (网络错误或 API 限制). 将在下个周期重试.");
      setLastFetchSuccessful(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    // 增加刷新间隔到 3 分钟，减少触发 CoinGecko 免费额度限制
    const interval = setInterval(fetchPrices, 180000); 
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // 为了实现无缝滚动，我们将列表复制一份
  const tickerItems = prices.length > 0 ? [...prices, ...prices] : [];

  return (
    <div className="w-full bg-crypto-dark border-b border-gray-800 overflow-hidden relative h-10 flex items-center group pause-on-hover">
      {/* 侧边渐变阴影 */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-crypto-dark to-transparent z-10 pointer-events-none"></div>
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-crypto-dark to-transparent z-10 pointer-events-none"></div>

      <div className={`flex whitespace-nowrap ${tickerItems.length > 0 ? 'animate-marquee' : ''} py-2`}>
        {tickerItems.length > 0 ? (
          tickerItems.map((coin, index) => (
            <div key={`${coin.id}-${index}`} className="flex items-center space-x-3 px-8 border-r border-gray-800/50">
              <span className="text-[10px] font-black text-gray-500 uppercase">{coin.symbol}</span>
              <span className="text-xs text-white font-mono font-bold">
                ${coin.current_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </span>
              <span className={`text-[10px] font-mono font-black ${coin.price_change_percentage_24h >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                {coin.price_change_percentage_24h >= 0 ? '▲' : '▼'} {Math.abs(coin.price_change_percentage_24h)?.toFixed(2)}%
              </span>
            </div>
          ))
        ) : (
          <div className="px-10 text-[10px] text-gray-600 italic tracking-widest flex items-center gap-2">
            {!lastFetchSuccessful ? (
              <span className="text-crypto-down">行情连接受限，正在后台重连...</span>
            ) : (
              <span>正在获取全球实时行情数据...</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CryptoTicker;
