import React, { useState, useEffect, useMemo } from 'react';
import TradeCalculator from './components/TradeCalculator';
import Calendar from './components/Calendar';
import { TradeRecord, DailyNote } from './types';
import { generateDailyAIReport } from './services/geminiService';
import { 
  Search,
  RefreshCw, 
  NotebookPen, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock,
  Activity,
  Calendar as CalendarIcon,
  X,
  Sparkles,
  List,
  ChevronRight,
  Hash,
  MessageSquare
} from 'lucide-react';

const App: React.FC = () => {
  // --- 数据持久化 ---
  const [trades, setTrades] = useState<TradeRecord[]>(() => JSON.parse(localStorage.getItem('crypto_trades') || '[]'));
  const [dailyNotes, setDailyNotes] = useState<Record<string, DailyNote>>(() => JSON.parse(localStorage.getItem('crypto_notes') || '{}'));
  const [aiReports, setAiReports] = useState<Record<string, string>>(() => JSON.parse(localStorage.getItem('crypto_ai_reports') || '{}'));

  // --- UI 状态 ---
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'daily' | 'timeline'>('daily');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  useEffect(() => localStorage.setItem('crypto_trades', JSON.stringify(trades)), [trades]);
  useEffect(() => localStorage.setItem('crypto_notes', JSON.stringify(dailyNotes)), [dailyNotes]);
  useEffect(() => localStorage.setItem('crypto_ai_reports', JSON.stringify(aiReports)), [aiReports]);

  // --- 核心操作 ---
  const addTrade = (trade: TradeRecord) => {
    const tradeWithDate = { ...trade, dateStr: selectedDate };
    setTrades([tradeWithDate, ...trades]);
  };

  const updateDailySummary = (text: string) => {
    // 增强正则：支持中文和英文标签
    const tags = Array.from(text.matchAll(/#([\u4e00-\u9fa5\w]+)/g)).map(match => match[1]);
    setDailyNotes(prev => ({
      ...prev,
      [selectedDate]: { dateStr: selectedDate, summary: text, tags }
    }));
  };

  const handleGenerateReport = async () => {
    setIsGeneratingAI(true);
    const dayTrades = trades.filter(t => t.dateStr === selectedDate);
    const dayNote = dailyNotes[selectedDate] || { dateStr: selectedDate, summary: '', tags: [] };
    const report = await generateDailyAIReport(selectedDate, dayTrades, dayNote);
    setAiReports(prev => ({ ...prev, [selectedDate]: report }));
    setIsGeneratingAI(false);
  };

  // --- 数据过滤 ---
  const filteredTrades = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (q) {
      return trades.filter(t => 
        t.symbol.toLowerCase().includes(q) || 
        t.note.toLowerCase().includes(q) ||
        (dailyNotes[t.dateStr]?.summary || '').toLowerCase().includes(q) ||
        (dailyNotes[t.dateStr]?.tags || []).some(tag => tag.toLowerCase().includes(q.replace('#','')))
      );
    }
    return trades.filter(t => t.dateStr === selectedDate);
  }, [trades, selectedDate, searchQuery, dailyNotes]);

  // 所有写过心得的日期
  // Fix: Explicitly cast Object.values(dailyNotes) to DailyNote[] to resolve 'unknown' type errors on summary and dateStr.
  const noteTimeline = useMemo(() => {
    return (Object.values(dailyNotes) as DailyNote[])
      .filter(n => n.summary.trim().length > 0)
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [dailyNotes]);

  const currentNote = dailyNotes[selectedDate] || { summary: '', tags: [] };
  const currentAiReport = aiReports[selectedDate];

  return (
    <div className="min-h-screen bg-crypto-dark text-gray-200 selection:bg-crypto-accent/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-crypto-dark/80 backdrop-blur-md border-b border-gray-800 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-crypto-accent rounded-xl text-crypto-dark shadow-lg shadow-crypto-accent/20">
            <NotebookPen size={20} />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-white">CRYPTO<span className="text-crypto-accent italic">LOG</span></h1>
        </div>

        <div className="flex-1 max-w-lg mx-8 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="text" 
            placeholder="搜币种、心得或 #中文标签..."
            className="w-full bg-gray-900 border border-gray-800 rounded-full py-2 pl-12 pr-4 text-sm focus:outline-none focus:border-crypto-accent transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={16}/></button>}
        </div>

        <div className="flex items-center gap-4">
           <div className="text-right hidden sm:block">
              <p className="text-[10px] text-gray-500 font-bold uppercase">Total Profit</p>
              <p className="text-sm font-mono font-black text-crypto-up">${trades.reduce((a,b)=>a+b.pnl,0).toFixed(2)}</p>
           </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-crypto-card rounded-2xl border border-gray-800 p-4 shadow-xl">
            <Calendar 
              trades={trades} 
              dailyNotes={dailyNotes} 
              selectedDate={selectedDate} 
              onSelectDate={(d) => { setSelectedDate(d); setActiveTab('daily'); }} 
            />
          </div>
          <TradeCalculator onAddTrade={addTrade} />
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8">
          <div className="flex gap-2 mb-6 p-1 bg-gray-900 w-fit rounded-xl border border-gray-800">
            <button onClick={() => setActiveTab('daily')} className={`px-6 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'daily' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500'}`}><Activity size={14}/>当日复盘</button>
            <button onClick={() => setActiveTab('timeline')} className={`px-6 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'timeline' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500'}`}><List size={14}/>日记时间轴</button>
          </div>

          {activeTab === 'daily' ? (
            <div className="space-y-6">
              {/* 心得编辑区 */}
              <section className="bg-crypto-card p-6 rounded-2xl border border-gray-800 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><CalendarIcon size={18} className="text-indigo-400"/> {selectedDate} 复盘心得</h2>
                  <div className="flex gap-1">
                    {currentNote.tags.map(t => <span key={t} className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[10px] font-bold">#{t}</span>)}
                  </div>
                </div>
                <textarea 
                  className="w-full h-40 bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-sm focus:outline-none focus:border-crypto-accent resize-none mb-4"
                  placeholder="记录今日的市场情绪、关键操作决策... (支持 #中文标签)"
                  value={currentNote.summary}
                  onChange={(e) => updateDailySummary(e.target.value)}
                />
                <button 
                  onClick={handleGenerateReport} 
                  disabled={isGeneratingAI}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {isGeneratingAI ? <RefreshCw size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                  {currentAiReport ? '重新生成 AI 诊断' : '生成 AI 深度分析报告'}
                </button>
              </section>

              {/* AI 报告展示 */}
              {currentAiReport && (
                <section className="bg-indigo-950/20 border border-indigo-500/30 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles size={60}/></div>
                  <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">AI 交易诊断报告</h3>
                  <div className="prose prose-invert prose-sm max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {currentAiReport}
                  </div>
                </section>
              )}

              {/* 当日交易列表 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTrades.map(trade => (
                  <div key={trade.id} className="bg-crypto-card p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                       <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{trade.symbol}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${trade.direction === 'LONG' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-rose-900/50 text-rose-400'}`}>
                            {trade.direction} {trade.leverage}x
                          </span>
                       </div>
                       <span className={`text-sm font-mono font-bold ${trade.pnl >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                         {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                       </span>
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono mb-2">${trade.entryPrice} ➜ ${trade.exitPrice} ({trade.roi.toFixed(1)}%)</p>
                    <div className="flex items-center justify-between">
                       <span className="text-[11px] text-gray-400 italic">“{trade.note || '无备注'}”</span>
                       <button onClick={() => setTrades(trades.filter(t => t.id !== trade.id))} className="text-gray-700 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* 日记流视图 */
            <div className="space-y-4">
              {noteTimeline.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-800 rounded-3xl">
                   <MessageSquare size={40} className="mb-2 opacity-20"/>
                   <p>还没有写过日记心得</p>
                </div>
              ) : (
                noteTimeline.map(note => (
                  <div key={note.dateStr} onClick={() => { setSelectedDate(note.dateStr); setActiveTab('daily'); }} 
                    className="bg-crypto-card p-5 rounded-2xl border border-gray-800 hover:border-crypto-accent/50 transition-all cursor-pointer group">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-white">{note.dateStr}</span>
                        <div className="flex gap-1">
                          {note.tags.map(t => <span key={t} className="text-[9px] bg-gray-900 text-gray-500 px-1.5 py-0.5 rounded">#{t}</span>)}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-700 group-hover:text-crypto-accent transition-colors"/>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
                      {note.summary}
                    </p>
                    <div className="mt-3 pt-3 border-t border-gray-800/50 flex gap-4 text-[10px] text-gray-600 font-bold uppercase">
                       <span>Trades: {trades.filter(t => t.dateStr === note.dateStr).length}</span>
                       <span>Daily PnL: <span className={trades.filter(t=>t.dateStr===note.dateStr).reduce((a,b)=>a+b.pnl,0) >= 0 ? 'text-crypto-up' : 'text-crypto-down'}>
                         ${trades.filter(t=>t.dateStr===note.dateStr).reduce((a,b)=>a+b.pnl,0).toFixed(2)}
                       </span></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;