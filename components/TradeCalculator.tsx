
import React, { useState, useEffect, useRef } from 'react';
import { TradeType, PositionDirection, TradeRecord, CalculatorState, CryptoPrice, TradeStatus } from '../types';
import { Search, Calculator, Save, DollarSign, TrendingUp, TrendingDown, Target } from 'lucide-react';

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

  const [result, setResult] = useState({ pnl: 0, roi: 0 });
  const [availableCoins, setAvailableCoins] = useState<CryptoPrice[]>([]);
  const [filteredCoins, setFilteredCoins] = useState<CryptoPrice[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCoinPrice, setSelectedCoinPrice] = useState<number | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=150')
      .then(res => res.json())
      .then(data => setAvailableCoins(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (state.symbol) {
      const lower = state.symbol.toLowerCase();
      setFilteredCoins(availableCoins.filter(c => c.symbol.toLowerCase().includes(lower) || c.name.toLowerCase().includes(lower)).slice(0, 8));
    }
  }, [state.symbol, availableCoins]);

  useEffect(() => {
    const entry = parseFloat(state.entryPrice);
    const exit = parseFloat(state.exitPrice);
    const amt = parseFloat(state.amount);
    const lev = parseFloat(state.leverage);
    if (!isNaN(entry) && !isNaN(exit) && !isNaN(amt)) {
      const size = state.type === 'SPOT' ? amt/entry : (amt * lev)/entry;
      let pnl = state.direction === 'LONG' ? (exit - entry) * size : (entry - exit) * size;
      setResult({ pnl, roi: (pnl/amt)*100 });
    }
  }, [state]);

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
      dateStr: '' // 由 App.tsx 填充
    });
    setState(s => ({ ...s, entryPrice: '', exitPrice: '', note: '' }));
  };

  return (
    <div className="bg-crypto-card rounded-2xl p-5 shadow-xl border border-gray-800">
      <div className="flex items-center gap-2 mb-4 text-white font-bold text-sm uppercase tracking-wider">
         <Calculator size={16} className="text-crypto-accent" />
         <span>快速计算 & 登记</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 bg-gray-900/50 p-1 rounded-xl">
           <button type="button" onClick={() => setState(s => ({ ...s, type: 'SPOT', direction: 'LONG', leverage: '1' }))} className={`py-1.5 rounded-lg text-[10px] font-bold transition-all ${state.type === 'SPOT' ? 'bg-crypto-accent text-crypto-dark' : 'text-gray-500'}`}>SPOT</button>
           <button type="button" onClick={() => setState(s => ({ ...s, type: 'FUTURES' }))} className={`py-1.5 rounded-lg text-[10px] font-bold transition-all ${state.type === 'FUTURES' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>FUTURES</button>
        </div>

        <div className="relative" ref={searchWrapperRef}>
          <div className="relative">
            <Search size={12} className="absolute left-3 top-2.5 text-gray-500" />
            <input
              type="text"
              name="symbol"
              value={state.symbol}
              onChange={(e) => { setState(s => ({ ...s, symbol: e.target.value })); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-8 pr-3 py-2 text-white focus:border-crypto-accent focus:outline-none uppercase text-xs font-bold"
              placeholder="BTC..."
              autoComplete="off"
              required
            />
          </div>
          {showDropdown && filteredCoins.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-h-40 overflow-y-auto">
              {filteredCoins.map(coin => (
                <div key={coin.id} onClick={() => { setState(s => ({ ...s, symbol: coin.symbol.toUpperCase(), coinId: coin.id })); setSelectedCoinPrice(coin.current_price); setShowDropdown(false); }} className="p-2 hover:bg-gray-700 cursor-pointer flex justify-between items-center text-[10px]">
                  <span className="font-bold text-white uppercase">{coin.symbol}</span>
                  <span className="text-crypto-accent font-mono">${coin.current_price}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] text-gray-500 font-bold uppercase mb-1 block">Entry</label>
            <input type="number" step="any" value={state.entryPrice} onChange={e => setState(s => ({ ...s, entryPrice: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono" required />
          </div>
          <div>
            <label className="text-[9px] text-gray-500 font-bold uppercase mb-1 block">{state.status === 'HOLDING' ? 'Target/Current' : 'Exit'}</label>
            <input type="number" step="any" value={state.exitPrice} onChange={e => setState(s => ({ ...s, exitPrice: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] text-gray-500 font-bold uppercase mb-1 block">Margin (U)</label>
            <input type="number" step="any" value={state.amount} onChange={e => setState(s => ({ ...s, amount: e.target.value }))} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono" required />
          </div>
          {state.type === 'FUTURES' && (
            <div>
              <label className="text-[9px] text-gray-500 font-bold uppercase mb-1 block">Lev: {state.leverage}x</label>
              <input type="range" min="1" max="100" value={state.leverage} onChange={e => setState(s => ({ ...s, leverage: e.target.value }))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-crypto-accent mt-3" />
            </div>
          )}
        </div>

        <div className="bg-black/40 rounded-xl p-3 border border-gray-800 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[9px] text-gray-500 uppercase font-bold">Est. PnL</span>
              <span className={`text-sm font-black font-mono ${result.pnl >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                {result.pnl >= 0 ? '+' : ''}{result.pnl.toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-gray-500 uppercase font-bold block">ROI</span>
              <span className={`text-xs font-bold ${result.roi >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>{result.roi.toFixed(1)}%</span>
            </div>
        </div>

        <button type="submit" className="w-full bg-crypto-accent hover:bg-crypto-accent/90 text-crypto-dark font-black py-2.5 rounded-xl text-xs uppercase shadow-lg shadow-crypto-accent/10 flex items-center justify-center gap-2">
          <Save size={14} /> 确认记账
        </button>
      </form>
    </div>
  );
};

export default TradeCalculator;
