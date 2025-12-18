
import React, { useState, useEffect, useCallback } from 'react';
import { TradeType, PositionDirection, TradeRecord, CalculatorState, CryptoPrice, TradeStatus } from '../types';
import { Search, Calculator, Save, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface TradeCalculatorProps {
  onAddTrade: (trade: TradeRecord) => void;
}

// 基础备选币种，防止 API 挂掉导致无法选择
const FALLBACK_COINS: CryptoPrice[] = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 0, price_change_percentage_24h: 0 },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum', current_price: 0, price_change_percentage_24h: 0 },
  { id: 'solana', symbol: 'sol', name: 'Solana', current_price: 0, price_change_percentage_24h: 0 },
  { id: 'binancecoin', symbol: 'bnb', name: 'BNB', current_price: 0, price_change_percentage_24h: 0 },
];

const TradeCalculator: React.FC<TradeCalculatorProps> = ({ onAddTrade }) => {
  const [state, setState] = useState<CalculatorState>({
    symbol: '',
    coinId: '',
    entryPrice: '',
    exitPrice: '',
    amount: '',
    leverage: '20',
    direction: 'LONG',
    type: 'FUTURES',
    status: 'HOLDING',
    note: ''
  });

  const [result, setResult] = useState({ pnl: 0, roi: 0 });
  const [availableCoins, setAvailableCoins] = useState<CryptoPrice[]>(FALLBACK_COINS);
  const [filteredCoins, setFilteredCoins] = useState<CryptoPrice[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentMarketPrice, setCurrentMarketPrice] = useState<number | null>(null);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250')
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setAvailableCoins(data);
          setApiError(false);
        }
      })
      .catch(() => {
        setApiError(true);
        console.warn("Using fallback coin list due to fetch error");
      });
  }, []);

  useEffect(() => {
    if (state.symbol) {
      const lower = state.symbol.toLowerCase();
      setFilteredCoins(availableCoins.filter(c => 
        c.symbol.toLowerCase().includes(lower) || 
        c.name.toLowerCase().includes(lower)
      ).slice(0, 8));
    } else {
      setFilteredCoins(availableCoins.slice(0, 5));
    }
  }, [state.symbol, availableCoins]);

  useEffect(() => {
    const entry = parseFloat(state.entryPrice);
    const exit = parseFloat(state.exitPrice);
    const amt = parseFloat(state.amount);
    const lev = parseFloat(state.leverage);
    
    if (!isNaN(entry) && !isNaN(exit) && !isNaN(amt)) {
      const size = state.type === 'SPOT' ? amt : amt * lev;
      const coinAmount = size / entry;
      let pnl = state.direction === 'LONG' ? (exit - entry) * coinAmount : (entry - exit) * coinAmount;
      setResult({ pnl, roi: (pnl / amt) * 100 });
    } else {
      setResult({ pnl: 0, roi: 0 });
    }
  }, [state]);

  const fillPrice = (target: 'entry' | 'exit') => {
    if (currentMarketPrice) {
      setState(s => ({ ...s, [target === 'entry' ? 'entryPrice' : 'exitPrice']: currentMarketPrice.toString() }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddTrade({
      id: crypto.randomUUID(),
      coinId: state.coinId,
      symbol: state.symbol.toUpperCase() || 'UNKNOWN',
      type: state.type,
      direction: state.direction,
      status: state.status,
      entryPrice: parseFloat(state.entryPrice) || 0,
      exitPrice: parseFloat(state.exitPrice) || 0,
      amount: parseFloat(state.amount) || 0,
      leverage: state.type === 'SPOT' ? 1 : parseFloat(state.leverage),
      pnl: result.pnl,
      roi: result.roi,
      note: state.note,
      timestamp: Date.now(),
      dateStr: '' 
    });
    setState(s => ({ ...s, entryPrice: '', exitPrice: '', note: '', symbol: '', coinId: '' }));
    setCurrentMarketPrice(null);
    setShowDropdown(false);
  };

  return (
    <div className="bg-crypto-card rounded-2xl p-5 border border-gray-800 shadow-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-bold text-base">
          <Calculator size={18} className="text-crypto-accent" />
          <span>盈亏计算器</span>
        </div>
        {apiError && (
          <div className="group relative">
            <AlertCircle size={14} className="text-amber-500 cursor-help" />
            <div className="absolute right-0 bottom-full mb-2 w-48 p-2 bg-gray-900 border border-gray-700 rounded text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              行情服务由于频率限制暂时无法连接，已启用备选币种清单。
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 bg-gray-900 p-1 rounded-xl">
          <button type="button" onClick={() => setState(s => ({ ...s, type: 'SPOT', leverage: '1' }))}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${state.type === 'SPOT' ? 'bg-gray-800 text-white shadow' : 'text-gray-500'}`}>现货 SPOT</button>
          <button type="button" onClick={() => setState(s => ({ ...s, type: 'FUTURES' }))}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${state.type === 'FUTURES' ? 'bg-purple-600 text-white shadow' : 'text-gray-500'}`}>合约 FUTURES</button>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-gray-900 p-1 rounded-xl">
          <button type="button" onClick={() => setState(s => ({ ...s, status: 'CLOSED' }))}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${state.status === 'CLOSED' ? 'bg-gray-800 text-white shadow' : 'text-gray-500'}`}>已平仓</button>
          <button type="button" onClick={() => setState(s => ({ ...s, status: 'HOLDING' }))}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${state.status === 'HOLDING' ? 'bg-blue-600 text-white shadow' : 'text-gray-500'}`}>持仓中</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 relative">
              <label className="text-[10px] text-gray-500 font-bold uppercase px-1 tracking-tighter">币种 Symbol</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input type="text" value={state.symbol} 
                  onFocus={() => setShowDropdown(true)}
                  onChange={(e) => { setState(s => ({ ...s, symbol: e.target.value })); setShowDropdown(true); }}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-crypto-accent focus:outline-none uppercase font-bold"
                  placeholder="如 BTC" required autoComplete="off" />
              </div>
              {showDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto">
                  {filteredCoins.map(coin => (
                    <div key={coin.id} onClick={() => { 
                      setState(s => ({ ...s, symbol: coin.symbol.toUpperCase(), coinId: coin.id })); 
                      if(coin.current_price > 0) setCurrentMarketPrice(coin.current_price);
                      setShowDropdown(false); 
                    }}
                      className="p-3 hover:bg-gray-800 cursor-pointer flex justify-between items-center border-b border-gray-800/50 last:border-0 group">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white group-hover:text-crypto-accent transition-colors">{coin.symbol.toUpperCase()}</span>
                        <span className="text-[9px] text-gray-500">{coin.name}</span>
                      </div>
                      {coin.current_price > 0 && <span className="text-[10px] text-crypto-accent font-mono">${coin.current_price.toLocaleString()}</span>}
                    </div>
                  ))}
                  {filteredCoins.length === 0 && (
                     <div className="p-3 text-[10px] text-gray-600 text-center">输入代号手动登记</div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-bold uppercase px-1">方向 Side</label>
              <div className="grid grid-cols-2 gap-1 bg-gray-900 p-1 rounded-xl">
                <button type="button" onClick={() => setState(s => ({ ...s, direction: 'LONG' }))}
                  className={`py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${state.direction === 'LONG' ? 'bg-emerald-500 text-white' : 'text-gray-500'}`}>
                  <TrendingUp size={12}/> 多
                </button>
                <button type="button" onClick={() => setState(s => ({ ...s, direction: 'SHORT' }))}
                  className={`py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${state.direction === 'SHORT' ? 'bg-rose-500 text-white' : 'text-gray-500'}`}>
                   空 <TrendingDown size={12}/>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase">开仓价格</label>
                {currentMarketPrice && <button type="button" onClick={() => fillPrice('entry')} className="text-[9px] text-crypto-accent hover:underline">现价</button>}
              </div>
              <input type="number" step="any" value={state.entryPrice} onChange={e => setState(s => ({ ...s, entryPrice: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono" placeholder="0.00" required />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase">平仓/当前价</label>
                {currentMarketPrice && <button type="button" onClick={() => fillPrice('exit')} className="text-[9px] text-crypto-accent hover:underline">现价</button>}
              </div>
              <input type="number" step="any" value={state.exitPrice} onChange={e => setState(s => ({ ...s, exitPrice: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono" placeholder="0.00" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-bold uppercase px-1">保证金 (USDT)</label>
              <input type="number" step="any" value={state.amount} onChange={e => setState(s => ({ ...s, amount: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono" placeholder="100.0" required />
            </div>
            {state.type === 'FUTURES' && (
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase px-1 flex justify-between">杠杆: <span className="text-crypto-accent font-mono">{state.leverage}X</span></label>
                <input type="range" min="1" max="125" value={state.leverage} onChange={e => setState(s => ({ ...s, leverage: e.target.value }))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500 mt-2.5" />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 font-bold uppercase px-1">短评 Note</label>
            <textarea value={state.note} onChange={e => setState(s => ({ ...s, note: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-xs text-gray-300 resize-none h-14 focus:outline-none focus:border-crypto-accent" placeholder="例如：回踩 0.618 进场..."></textarea>
          </div>

          <div className="bg-black/40 rounded-xl p-4 border border-gray-800/50 space-y-2">
             <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">预期收益</span>
                <span className={`text-sm font-black font-mono ${result.pnl >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                  {result.pnl >= 0 ? '+' : ''}${result.pnl.toFixed(2)}
                </span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">盈利率 ROI</span>
                <span className={`text-xs font-bold font-mono ${result.roi >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>{result.roi.toFixed(2)}%</span>
             </div>
          </div>

          <button type="submit" className={`w-full font-black py-3.5 rounded-xl text-xs uppercase flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-lg ${state.status === 'HOLDING' ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20 text-white' : 'bg-crypto-accent hover:bg-sky-400 text-crypto-dark shadow-sky-900/20'}`}>
            <Save size={14} /> {state.status === 'HOLDING' ? '保存持仓记录' : '记录到复盘日记'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TradeCalculator;
