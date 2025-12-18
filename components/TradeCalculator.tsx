
import React, { useState, useEffect } from 'react';
import { TradeType, PositionDirection, TradeRecord, CalculatorState, CryptoPrice, TradeStatus } from '../types';
import { Search, Calculator, Save, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface TradeCalculatorProps {
  onAddTrade: (trade: TradeRecord) => void;
}

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
  const [availableCoins, setAvailableCoins] = useState<CryptoPrice[]>([]);
  const [filteredCoins, setFilteredCoins] = useState<CryptoPrice[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentMarketPrice, setCurrentMarketPrice] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200')
      .then(res => res.json())
      .then(data => setAvailableCoins(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (state.symbol) {
      const lower = state.symbol.toLowerCase();
      setFilteredCoins(availableCoins.filter(c => c.symbol.toLowerCase().includes(lower) || c.name.toLowerCase().includes(lower)).slice(0, 5));
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
  };

  return (
    <div className="bg-crypto-card rounded-2xl p-5 border border-gray-800 shadow-2xl space-y-5">
      <div className="flex items-center gap-2 text-white font-bold text-base">
        <Calculator size={18} className="text-crypto-accent" />
        <span>盈亏计算 & 登记</span>
      </div>

      <div className="space-y-4">
        {/* 类型切换 */}
        <div className="grid grid-cols-2 gap-2 bg-gray-900 p-1 rounded-xl">
          <button type="button" onClick={() => setState(s => ({ ...s, type: 'SPOT', leverage: '1' }))}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${state.type === 'SPOT' ? 'bg-gray-800 text-white shadow' : 'text-gray-500'}`}>现货 SPOT</button>
          <button type="button" onClick={() => setState(s => ({ ...s, type: 'FUTURES' }))}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${state.type === 'FUTURES' ? 'bg-purple-600 text-white shadow' : 'text-gray-500'}`}>合约 FUTURES</button>
        </div>

        {/* 状态切换 */}
        <div className="grid grid-cols-2 gap-2 bg-gray-900 p-1 rounded-xl">
          <button type="button" onClick={() => setState(s => ({ ...s, status: 'CLOSED' }))}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${state.status === 'CLOSED' ? 'bg-gray-800 text-white shadow' : 'text-gray-500'}`}>已平仓</button>
          <button type="button" onClick={() => setState(s => ({ ...s, status: 'HOLDING' }))}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${state.status === 'HOLDING' ? 'bg-blue-600 text-white shadow' : 'text-gray-500'}`}>持仓中 / 挂单</button>
        </div>

        {currentMarketPrice && (
          <div className="text-center text-xs text-crypto-accent font-mono">现价: ${currentMarketPrice.toLocaleString()}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* 币种 */}
            <div className="space-y-1 relative">
              <label className="text-[10px] text-gray-500 font-bold uppercase px-1">币种</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input type="text" value={state.symbol} onChange={(e) => { setState(s => ({ ...s, symbol: e.target.value })); setShowDropdown(true); }}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-crypto-accent focus:outline-none uppercase font-bold"
                  placeholder="BNB" required autoComplete="off" />
              </div>
              {showDropdown && filteredCoins.length > 0 && (
                <div className="absolute z-30 w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                  {filteredCoins.map(coin => (
                    <div key={coin.id} onClick={() => { setState(s => ({ ...s, symbol: coin.symbol.toUpperCase(), coinId: coin.id })); setCurrentMarketPrice(coin.current_price); setShowDropdown(false); }}
                      className="p-2 hover:bg-gray-700 cursor-pointer flex justify-between items-center border-b border-gray-700/50 last:border-0">
                      <span className="text-[10px] font-bold text-white">{coin.symbol.toUpperCase()}</span>
                      <span className="text-[10px] text-crypto-accent font-mono">${coin.current_price}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* 方向 */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-bold uppercase px-1">方向</label>
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
                <label className="text-[10px] text-gray-500 font-bold uppercase">开仓价</label>
                <button type="button" onClick={() => fillPrice('entry')} className="text-[10px] text-crypto-accent hover:underline">填现价</button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs">$</span>
                <input type="number" step="any" value={state.entryPrice} onChange={e => setState(s => ({ ...s, entryPrice: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-6 pr-3 py-2 text-xs text-white font-mono" required />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase">当前价/目标价</label>
                <button type="button" onClick={() => fillPrice('exit')} className="text-[10px] text-crypto-accent hover:underline">填现价</button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs">$</span>
                <input type="number" step="any" value={state.exitPrice} onChange={e => setState(s => ({ ...s, exitPrice: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-6 pr-3 py-2 text-xs text-white font-mono" required />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-bold uppercase px-1">保证金 (U)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs">$</span>
                <input type="number" step="any" value={state.amount} onChange={e => setState(s => ({ ...s, amount: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-6 pr-3 py-2 text-xs text-white font-mono" required />
              </div>
            </div>
            {state.type === 'FUTURES' && (
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase px-1 flex justify-between">杠杆: <span className="text-crypto-accent">{state.leverage}X</span></label>
                <input type="range" min="1" max="125" value={state.leverage} onChange={e => setState(s => ({ ...s, leverage: e.target.value }))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500 mt-2.5" />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 font-bold uppercase px-1">备注</label>
            <textarea value={state.note} onChange={e => setState(s => ({ ...s, note: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-xs text-gray-300 resize-none h-16 focus:outline-none focus:border-crypto-accent" placeholder="记录想法..."></textarea>
          </div>

          <div className="bg-black/30 rounded-xl p-4 border border-gray-800 space-y-2">
             <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase">预计盈亏</span>
                <span className={`text-sm font-black font-mono ${result.pnl >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                  {result.pnl >= 0 ? '+' : ''}${result.pnl.toFixed(2)}
                </span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase">ROI</span>
                <span className={`text-xs font-bold ${result.roi >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>{result.roi.toFixed(2)}%</span>
             </div>
          </div>

          <button type="submit" className={`w-full font-black py-3 rounded-xl text-sm uppercase flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg ${state.status === 'HOLDING' ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20' : 'bg-crypto-accent hover:bg-sky-400 text-crypto-dark shadow-sky-900/20'}`}>
            <Save size={16} /> {state.status === 'HOLDING' ? '记录持仓' : '记入复盘日记'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TradeCalculator;
