
import React, { useState, useEffect, useMemo } from 'react';
import TradeCalculator from './components/TradeCalculator';
import Calendar from './components/Calendar';
import { TradeRecord, CryptoPrice, DailyNote } from './types';
import { 
  Wallet, 
  Search,
  RefreshCw, 
  NotebookPen, 
  FileText, 
  Copy, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock,
  CheckCircle,
  Activity,
  Hash,
  Calendar as CalendarIcon,
  X
} from 'lucide-react';

const App: React.FC = () => {
  // --- State & Initialization ---
  const [trades, setTrades] = useState<TradeRecord[]>(() => {
    const saved = localStorage.getItem('crypto_trades');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [dailyNotes, setDailyNotes] = useState<Record<string, DailyNote>>(() => {
    const saved = localStorage.getItem('crypto_notes');
    return saved ? JSON.parse(saved) : {};
  });

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('crypto_trades', JSON.stringify(trades));
  }, [trades]);

  useEffect(() => {
    localStorage.setItem('crypto_notes', JSON.stringify(dailyNotes));
  }, [dailyNotes]);

  // --- Handlers ---
  const addTrade = (trade: TradeRecord) => {
    // 强制将新交易关联到当前选中的日期，或者交易创建日期
    const tradeWithDate = { ...trade, dateStr: selectedDate };
    setTrades([tradeWithDate, ...trades]);
  };

  const removeTrade = (id: string) => {
    if(confirm('确定删除此记录？')) setTrades(trades.filter(t => t.id !== id));
  };

  const updateTradeNote = (id: string, note: string) => {
    setTrades(trades.map(t => t.id === id ? { ...t, note } : t));
  };

  const updateDailySummary = (text: string) => {
    // 自动解析标签 #tag
    const tags = Array.from(text.matchAll(/#(\w+)/g)).map(match => match[1]);
    setDailyNotes(prev => ({
      ...prev,
      [selectedDate]: { dateStr: selectedDate, summary: text, tags }
    }));
  };

  const refreshPrices = async () => {
    const holding = trades.filter(t => t.status === 'HOLDING' && t.coinId);
    if (holding.length === 0) return;
    setRefreshing(true);
    const ids = Array.from(new Set(holding.map(t => t.coinId))).join(',');
    try {
      const resp = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}`);
      if (resp.ok) {
        const data: CryptoPrice[] = await resp.json();
        const priceMap = new Map(data.map(c => [c.id, c.current_price]));
        setTrades(prev => prev.map(t => {
          if (t.status === 'HOLDING' && t.coinId && priceMap.has(t.coinId)) {
            const cur = priceMap.get(t.coinId)!;
            const size = t.type === 'SPOT' ? t.amount/t.entryPrice : (t.amount*t.leverage)/t.entryPrice;
            const pnl = t.direction === 'LONG' ? (cur - t.entryPrice) * size : (t.entryPrice - cur) * size;
            return { ...t, exitPrice: cur, pnl, roi: (pnl/t.amount)*100 };
          }
          return t;
        }));
      }
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  };

  // --- Filtering Logic ---
  const filteredTrades = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return trades.filter(t => 
        t.symbol.toLowerCase().includes(q) || 
        t.note.toLowerCase().includes(q) ||
        (dailyNotes[t.dateStr]?.summary || '').toLowerCase().includes(q) ||
        (dailyNotes[t.dateStr]?.tags || []).some(tag => tag.toLowerCase().includes(q.replace('#','')))
      );
    }
    return trades.filter(t => t.dateStr === selectedDate);
  }, [trades, selectedDate, searchQuery, dailyNotes]);

  const closedTrades = filteredTrades.filter(t => t.status === 'CLOSED');
  const holdingTrades = filteredTrades.filter(t => t.status === 'HOLDING');
  
  const totalRealized = trades.filter(t => t.status === 'CLOSED').reduce((a, b) => a + b.pnl, 0);
  const totalUnrealized = trades.filter(t => t.status === 'HOLDING').reduce((a, b) => a + b.pnl, 0);

  const currentNote = dailyNotes[selectedDate] || { summary: '', tags: [] };

  // --- UI Components ---
  // Fix: Explicitly type TradeCard as a React.FC to allow the standard 'key' prop in JSX mapping
  const TradeCard: React.FC<{ trade: TradeRecord }> = ({ trade }) => (
    <div className={`p-3 transition-all border-l-4 rounded-r-lg mb-2 group ${
      trade.status === 'HOLDING' ? 'bg-blue-900/10 border-blue-500' : 'bg-crypto-card border-gray-700 hover:bg-gray-800'
    }`}>
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">{trade.symbol}</span>
            <span className={`text-[9px] px-1 rounded flex items-center gap-0.5 ${trade.direction === 'LONG' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-rose-900/50 text-rose-400'}`}>
              {trade.direction === 'LONG' ? <ArrowUpRight size={8} /> : <ArrowDownRight size={8} />}
              {trade.type === 'FUTURES' ? `${trade.leverage}x` : '现货'}
            </span>
            {searchQuery && (
              <span className="text-[9px] text-gray-500 flex items-center gap-1">
                <CalendarIcon size={8} /> {trade.dateStr}
              </span>
            )}
        </div>
        <div className="text-right">
          <div className={`text-xs font-mono font-bold ${trade.pnl >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
            {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between bg-black/30 rounded px-2 py-1 mb-2 text-[10px] text-gray-400 font-mono">
        <span>${trade.entryPrice} ➜ ${trade.exitPrice}</span>
        <span className={trade.roi >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{trade.roi.toFixed(1)}%</span>
      </div>
      <div className="relative">
        <input
            type="text"
            value={trade.note}
            onChange={(e) => updateTradeNote(trade.id, e.target.value)}
            placeholder="备注心得..."
            className="w-full bg-transparent border-b border-gray-800 focus:border-crypto-accent focus:outline-none py-0.5 text-[11px] text-gray-400"
        />
        <button onClick={() => removeTrade(trade.id)} className="absolute right-0 top-0 text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-crypto-dark text-gray-200 pb-20 selection:bg-crypto-accent/30">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-crypto-dark/80 backdrop-blur-xl border-b border-gray-800 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 h-14 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-crypto-accent p-1.5 rounded-lg text-crypto-dark shadow-lg shadow-crypto-accent/20">
              <NotebookPen size={18} />
            </div>
            <h1 className="text-lg font-black tracking-tighter text-white hidden md:block">CRYPTO<span className="text-crypto-accent italic">LOG</span></h1>
          </div>

          <div className="flex-1 max-w-md relative group">
             <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isSearching ? 'text-crypto-accent' : 'text-gray-500'}`} />
             <input 
                type="text"
                placeholder="搜索币种、笔记或 #标签..."
                className="w-full bg-gray-900/50 border border-gray-800 rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-crypto-accent focus:bg-gray-900 transition-all"
                value={searchQuery}
                onFocus={() => setIsSearching(true)}
                onBlur={() => setTimeout(() => setIsSearching(false), 200)}
                onChange={(e) => setSearchQuery(e.target.value)}
             />
             {searchQuery && (
               <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={14}/></button>
             )}
          </div>
          
          <div className="flex gap-2">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] text-gray-500 font-bold uppercase">Total PnL</span>
              <span className={`text-sm font-mono font-black ${(totalRealized + totalUnrealized) >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                ${(totalRealized + totalUnrealized).toFixed(2)}
              </span>
            </div>
            <button onClick={refreshPrices} disabled={refreshing} className={`p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-all ${refreshing ? 'animate-spin text-crypto-accent' : ''}`}>
               <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左侧：日历 & 计算器 */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-crypto-card rounded-2xl border border-gray-800 p-4 shadow-xl">
             <Calendar 
                trades={trades} 
                dailyNotes={dailyNotes} 
                selectedDate={selectedDate} 
                onSelectDate={setSelectedDate} 
             />
          </div>
          <TradeCalculator onAddTrade={addTrade} />
        </div>

        {/* 右侧：当期笔记 & 交易流 */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          
          {/* 每日总结区域 */}
          {!searchQuery && (
            <section className="bg-crypto-card p-6 rounded-2xl border border-gray-800 shadow-xl relative overflow-hidden">
               <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                      <CalendarIcon size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">{selectedDate} 复盘心得</h2>
                      <div className="flex gap-1 mt-0.5">
                        {currentNote.tags.map(tag => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-crypto-accent/10 text-crypto-accent rounded border border-crypto-accent/20 font-bold">#{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    {filteredTrades.length} Trades
                  </div>
               </div>
               <textarea
                  className="w-full h-32 bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-sm text-gray-200 focus:outline-none focus:border-crypto-accent focus:ring-1 focus:ring-crypto-accent/20 resize-none transition-all"
                  placeholder="记录今日的市场情绪、关键点位、心情... (使用 #标签 自动分类)"
                  value={currentNote.summary}
                  onChange={(e) => updateDailySummary(e.target.value)}
                />
            </section>
          )}

          {/* 交易流 */}
          <div className="flex flex-col flex-1">
             <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Activity size={14} className="text-crypto-accent"/> 
                  {searchQuery ? `搜索结果: "${searchQuery}"` : '交易记录'}
                </h3>
             </div>

             {filteredTrades.length === 0 ? (
               <div className="bg-crypto-card/30 rounded-2xl border border-dashed border-gray-800 h-64 flex flex-col items-center justify-center text-gray-600">
                  <Clock size={32} className="mb-2 opacity-20" />
                  <p className="text-sm">这一天暂无交易记录</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {(holdingTrades.length > 0) && (
                   <div className="md:col-span-2">
                      <div className="text-[10px] text-blue-400 font-bold mb-2 flex items-center gap-1 uppercase tracking-tighter"><div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div> Holding / Pending</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {holdingTrades.map(t => <TradeCard key={t.id} trade={t} />)}
                      </div>
                   </div>
                 )}
                 <div className="md:col-span-2">
                    <div className="text-[10px] text-gray-500 font-bold mb-2 uppercase tracking-tighter flex items-center gap-1"><div className="w-1 h-1 bg-gray-700 rounded-full"></div> History</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {closedTrades.map(t => <TradeCard key={t.id} trade={t} />)}
                    </div>
                 </div>
               </div>
             )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;
