
import React, { useState, useEffect, useCallback } from 'react';
import { TradeType, PositionDirection, TradeRecord, CalculatorState, CryptoPrice, TradeStatus } from '../types';
import { Search, Calculator, Save, TrendingUp, TrendingDown, AlertCircle, ShoppingCart } from 'lucide-react';

interface TradeCalculatorProps {
  onAddTrade: (trade: TradeRecord) => void;
  availableCoins: CryptoPrice[];
  apiError: boolean;
}

const FALLBACK_COINS: CryptoPrice[] = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 96000, price_change_percentage_24h: 0 },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum', current_price: 3300, price_change_percentage_24h: 0 },
  { id: 'solana', symbol: 'sol', name: 'Solana', current_price: 180, price_change_percentage_24h: 0 },
  { id: 'binancecoin', symbol: 'bnb', name: 'BNB', current_price: 600, price_change_percentage_24h: 0 },
  { id: 'ripple', symbol: 'xrp', name: 'XRP', current_price: 2.2, price_change_percentage_24h: 0 },
];

const TradeCalculator: React.FC<TradeCalculatorProps> = ({ onAddTrade, availableCoins, apiError }) => {
  const [state, setState] = useState<CalculatorState>({
    symbol: '',
    coinId: '',
    entryPrice: '',
    exitPrice: '',
    amount: '',
    leverage: '1',
    direction: 'LONG',
    type: 'SPOT',
    status: 'HOLDING',
    note: ''
  });

  const [result, setResult] = useState({ pnl: 0, roi: 0 });
  const [filteredCoins, setFilteredCoins] = useState<CryptoPrice[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentMarketPrice, setCurrentMarketPrice] = useState<number | null>(null);

  const isSpot = state.type === 'SPOT';
  const isHolding = state.status === 'HOLDING';

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
    const lev = isSpot ? 1 : parseFloat(state.leverage);
    
    if (!isNaN(entry) && !isNaN(exit) && !isNaN(amt)) {
      const size = isSpot ? amt : amt * lev;
      const coinAmount = size / entry;
      let pnl = state.direction === 'LONG' ? (exit - entry) * coinAmount : (entry - exit) * coinAmount;
      setResult({ pnl, roi: (amt > 0) ? (pnl / amt) * 100 : 0 });
    } else {
      setResult({ pnl: 0, roi: 0 });
    }
  }, [state, isSpot]);

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
      leverage: isSpot ? 1 : parseFloat(state.leverage),
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
          <span>{isSpot ? '现货盈亏计算' : '合约盈亏计算'}</span>
        </div>
        {apiError && <AlertCircle size={14} className="text-amber-500 animate-pulse" title="行情连接受限" />}
      </div>

      <div className="space-y-4">
        {/* 交易模式切换 */}
        <div className="grid grid-cols-2 gap-2 bg-gray-900 p-1 rounded-xl">
          <button type="button" onClick={() => setState(s => ({ ...s, type: 'SPOT', leverage: '1' }))}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${isSpot ? 'bg-emerald-600 text-white shadow' : 'text-gray-500'}`}>现货 SPOT</button>
          <button type="button" onClick={() => setState(s => ({ ...s, type: 'FUTURES', leverage: '20' }))}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${!isSpot ? 'bg-purple-600 text-white shadow' : 'text-gray-500'}`}>合约 FUTURES</button>
        </div>

        {/* 持仓状态切换 */}
        <div className="grid grid-cols-2 gap-2 bg-gray-900 p-1 rounded-xl">
          <button type="button" onClick={() => setState(s => ({ ...s, status: 'CLOSED' }))}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${!isHolding ? 'bg-gray-800 text-white shadow' : 'text-gray-500'}`}>
            {isSpot ? '已卖出/平仓' : '已平仓'}
          </button>
          <button type="button" onClick={() => setState(s => ({ ...s, status: 'HOLDING' }))}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${isHolding ? 'bg-blue-600 text-white shadow' : 'text-gray-500'}`}>
            {isSpot ? '当前持仓中' : '持仓中'}
          </button>
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
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-bold uppercase px-1">操作方向 Side</label>
              <div className="grid grid-cols-2 gap-1 bg-gray-900 p-1 rounded-xl">
                <button type="button" onClick={() => setState(s => ({ ...s, direction: 'LONG' }))}
                  className={`py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${state.direction === 'LONG' ? 'bg-emerald-500 text-white' : 'text-gray-500'}`}>
                  {isSpot ? <ShoppingCart size={12}/> : <TrendingUp size={12}/>} {isSpot ? '买入' : '做多'}
                </button>
                <button type="button" onClick={() => setState(s => ({ ...s, direction: 'SHORT' }))}
                  className={`py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${state.direction === 'SHORT' ? 'bg-rose-500 text-white' : 'text-gray-500'}`}>
                   {isSpot ? '卖出' : '做空'} {isSpot ? '' : <TrendingDown size={12}/>}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase">
                  {isSpot ? '买入价格' : '开仓价格'}
                </label>
                {currentMarketPrice && <button type="button" onClick={() => fillPrice('entry')} className="text-[9px] text-crypto-accent hover:underline">现价</button>}
              </div>
              <input type="number" step="any" value={state.entryPrice} onChange={e => setState(s => ({ ...s, entryPrice: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono" placeholder="0.00" required />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase">
                  {isHolding ? (isSpot ? '当前价格' : '当前/目标价') : (isSpot ? '卖出价格' : '平仓价格')}
                </label>
                {currentMarketPrice && <button type="button" onClick={() => fillPrice('exit')} className="text-[9px] text-crypto-accent hover:underline">现价</button>}
              </div>
              <input type="number" step="any" value={state.exitPrice} onChange={e => setState(s => ({ ...s, exitPrice: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono" placeholder="0.00" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-bold uppercase px-1">
                {isSpot ? '投入金额 (USDT)' : '保证金 (USDT)'}
              </label>
              <input type="number" step="any" value={state.amount} onChange={e => setState(s => ({ ...s, amount: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono" placeholder="100.0" required />
            </div>
            {!isSpot && (
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase px-1 flex justify-between">杠杆: <span className="text-crypto-accent font-mono">{state.leverage}X</span></label>
                <input type="range" min="1" max="125" value={state.leverage} onChange={e => setState(s => ({ ...s, leverage: e.target.value }))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500 mt-2.5" />
              </div>
            )}
            {isSpot && (
              <div className="space-y-1 opacity-50">
                <label className="text-[10px] text-gray-500 font-bold uppercase px-1">杠杆 (现货固定)</label>
                <div className="w-full bg-gray-800/30 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-500 font-mono">1X (NONE)</div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 font-bold uppercase px-1">交易心得 Note</label>
            <textarea value={state.note} onChange={e => setState(s => ({ ...s, note: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-xs text-gray-300 resize-none h-14 focus:outline-none focus:border-crypto-accent" placeholder={isSpot ? "记录买入理由或建仓计划..." : "例如：回踩 0.618 进场..."}></textarea>
          </div>

          <div className="bg-black/40 rounded-xl p-4 border border-gray-800/50 space-y-2">
             <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{isHolding ? '浮动盈亏' : '实际收益'}</span>
                <span className={`text-sm font-black font-mono ${result.pnl >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                  {result.pnl >= 0 ? '+' : ''}${result.pnl.toFixed(2)}
                </span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{isSpot ? '收益率' : '盈利率 ROI'}</span>
                <span className={`text-xs font-bold font-mono ${result.roi >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>{result.roi.toFixed(2)}%</span>
             </div>
          </div>

          <button type="submit" className={`w-full font-black py-3.5 rounded-xl text-xs uppercase flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-lg ${isHolding ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20 text-white' : 'bg-crypto-accent hover:bg-sky-400 text-crypto-dark shadow-sky-900/20'}`}>
            <Save size={14} /> {isHolding ? (isSpot ? '记录当前现货持仓' : '记录当前合约持仓') : '记入今日复盘日记'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TradeCalculator;
