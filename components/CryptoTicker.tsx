import React, { useEffect, useState } from 'react';
import { CryptoPrice } from '../types';

const COIN_IDS = 'bitcoin,ethereum,solana,binancecoin,ripple,dogecoin,cardano,avalanche-2,chainlink,polkadot';

const CryptoTicker: React.FC = () => {
  const [prices, setPrices] = useState<CryptoPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrices = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS}&order=market_cap_desc&per_page=10&page=1&sparkline=false`
      );
      if (response.ok) {
        const data = await response.json();
        setPrices(data);
        setLastUpdated(new Date());
      } else {
        console.error("Failed to fetch prices");
      }
    } catch (error) {
      console.error("Error fetching prices:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    // Refresh every 60s to avoid rate limits
    const interval = setInterval(fetchPrices, 60000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-crypto-card border-b border-gray-700 p-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
      <div className="flex items-center space-x-6 px-4">
        <button 
          onClick={fetchPrices}
          className="text-xs text-crypto-accent hover:text-white underline mr-2"
        >
          {loading ? '刷新中...' : '刷新行情'}
        </button>
        {prices.map((coin) => (
          <div key={coin.id} className="flex items-center space-x-2 text-sm">
            <span className="font-bold text-gray-300 uppercase">{coin.symbol}</span>
            <span className="text-white">${coin.current_price.toLocaleString()}</span>
            <span className={coin.price_change_percentage_24h >= 0 ? 'text-crypto-up' : 'text-crypto-down'}>
              {coin.price_change_percentage_24h.toFixed(2)}%
            </span>
          </div>
        ))}
        {lastUpdated && (
          <span className="text-xs text-gray-500 ml-auto block">
            更新于: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
};

export default CryptoTicker;