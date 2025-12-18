
import React, { useState, useEffect, useRef } from 'react';
import { TradeType, PositionDirection, TradeRecord, CalculatorState, CryptoPrice, TradeStatus } from '../types';
import { Search, Calculator, Save, RefreshCw, TrendingUp, TrendingDown, Info } from 'lucide-react';

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
    leverage: '1',
    direction: 'LONG',
    type: 'SPOT',
    status: 'CLOSED',
    note: ''
  });

  const [result, setResult] = useState({ pnl: 0, roi: 0, size: 0 });
  const [availableCoins, setAvailableCoins] = useState<CryptoPrice[]>([]);
  const [filteredCoins, setFilteredCoins] = useState<CryptoPrice[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentMarketPrice, setCurrentMarketPrice] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=150')
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
      setResult({ pnl, roi: (pnl / amt) * 100, size });
    }
  }, [state]);

  const syncPrice = () => {
    if (currentMarketPrice) {
      setState(s => ({ ...s, entryPrice: currentMarketPrice.toString() }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddTrade({
      id: crypto.randomUUID(),
      coinId: state.coinId,
      symbol: state.symbol.toUpperCase(),
      type: state.type,
      direction: state.direction,
      status: state.status,
      entryPrice: parseFloat(state.entryPrice),
      exitPrice: parseFloat(state.exitPrice),
      amount: parseFloat(state.amount),
      leverage: parseFloat(state.leverage),
      pnl: result.pnl,
      roi: result.roi,
      note: state.note,
      timestamp: Date.now(),
      dateStr: '' 
    });
    setState(s => ({ ...s, entryPrice: '', exitPrice: '', note: '' }));
  };

  return (
    <div className="bg-crypto-card rounded-2xl p-5 border border-gray-800 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <Calculator size={16} className="text-crypto-accent" />
          <span>专业盈亏计算</span>
        </div>
        <div className="flex gap-1 bg-gray-900 p-1 rounded-lg">
          {(['SPOT', 'FUTURES'] as TradeType[]).map(t => (
            <button key={t} type="button" onClick={() => setState(s => ({ ...s, type: t, leverage: t === 'SPOT' ? '1' : s.leverage }))}
              className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${state.type === t ? 'bg-crypto-accent text-crypto-dark' : 'text-gray-500'}`}>{t}</button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
           <button type="button" onClick={() => setState(s => ({ ...s, direction: 'LONG' }))} className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 ${state.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-gray-900 text-gray-500'}`}><TrendingUp size={14}/> 多头</button>
           <button type="button" onClick={() => setState(s => ({ ...s, direction: 'SHORT' }))} className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 ${state.direction === 'SHORT' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50' : 'bg-gray-900 text-gray-500'}`}><TrendingDown size={14}/> 空头</button>
        </div>

        <div className="relative">
          <input type="text" value={state.symbol} onChange={(e) => { setState(s => ({ ...s, symbol: e.target.value })); setShowDropdown(true); }}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-4 pr-10 py-2.5 text-sm text-white focus:border-crypto-accent focus:outline-none uppercase font-bold"
            placeholder="搜索币种 (如 BTC)" required autoComplete="off" />
          <Search size={14} className="absolute right-3 top-3.5 text-gray-600" />
          {showDropdown && filteredCoins.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl">
              {filteredCoins.map(coin => (
                <div key={coin.id} onClick={() => { setState(s => ({ ...s, symbol: coin.symbol.toUpperCase(), coinId: coin.id })); setCurrentMarketPrice(coin.current_price); setShowDropdown(false); }}
                  className="p-3 hover:bg-gray-700 cursor-pointer flex justify-between items-center border-b border-gray-700/50 last:border-0">
                  <span className="text-xs font-bold text-white">{coin.name} ({coin.symbol.toUpperCase()})</span>
                  <span className="text-xs text-crypto-accent font-mono">${coin.current_price}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] text-gray-500 font-bold uppercase">进场价</label>
              <button type="button" onClick={syncPrice} className="text-[10px] text-crypto-accent hover:underline flex items-center gap-0.5"><RefreshCw size={10}/>同步</button>
            </div>
            <input type="number" step="any" value={state.entryPrice} onChange={e => setState(s => ({ ...s, entryPrice: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono" required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 font-bold uppercase px-1">出场价 / 现价</label>
            <input type="number" step="any" value={state.exitPrice} onChange={e => setState(s => ({ ...s, exitPrice: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 font-bold uppercase px-1">投入本金 (U)</label>
            <input type="number" step="any" value={state.amount} onChange={e => setState(s => ({ ...s, amount: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono" required />
          </div>
          {state.type === 'FUTURES' && (
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-bold uppercase px-1">杠杆倍数: {state.leverage}x</label>
              <input type="range" min="1" max="125" value={state.leverage} onChange={e => setState(s => ({ ...s, leverage: e.target.value }))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-crypto-accent mt-3" />
            </div>
          )}
        </div>

        <div className="bg-black/30 rounded-2xl p-4 border border-gray-800 space-y-2">
           <div className="flex justify-between text-[10px] text-gray-500 font-bold">
              <span>名义价值: ${result.size.toFixed(2)}</span>
              <span>状态: <span className={state.status === 'CLOSED' ? 'text-gray-400' : 'text-blue-400'}>{state.status}</span></span>
           </div>
           <div className="flex justify-between items-end">
              <div>
                <span className="text-[10px] text-gray-500 block">预期收益</span>
                <span className={`text-lg font-black font-mono ${result.pnl >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                  {result.pnl >= 0 ? '+' : ''}{result.pnl.toFixed(2)} <span className="text-xs uppercase">USDT</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-500 block">收益率 (ROI)</span>
                <span className={`text-sm font-bold ${result.roi >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>{result.roi.toFixed(2)}%</span>
              </div>
           </div>
        </div>

        <button type="submit" className="w-full bg-crypto-accent hover:bg-crypto-accent/90 text-crypto-dark font-black py-3 rounded-xl text-sm uppercase flex items-center justify-center gap-2 transition-transform active:scale-95">
          <Save size={16} /> 记入复盘日记
        </button>
      </form>
    </div>
  );
};

export default TradeCalculator;
