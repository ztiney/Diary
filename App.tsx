
import React, { useState, useEffect, useMemo } from 'react';
import TradeCalculator from './components/TradeCalculator';
import Calendar from './components/Calendar';
import { TradeRecord, DailyNote } from './types';
import { 
  Search,
  NotebookPen, 
  Trash2, 
  Activity,
  Calendar as CalendarIcon,
  X,
  FileText,
  List,
  ChevronRight,
  MessageSquare,
  Check,
  Hash,
  TrendingUp,
  Tag
} from 'lucide-react';

const App: React.FC = () => {
  // --- 数据持久化 ---
  const [trades, setTrades] = useState<TradeRecord[]>(() => JSON.parse(localStorage.getItem('crypto_trades') || '[]'));
  const [dailyNotes, setDailyNotes] = useState<Record<string, DailyNote>>(() => JSON.parse(localStorage.getItem('crypto_notes') || '{}'));

  // --- UI 状态 ---
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'daily' | 'timeline'>('daily');
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => localStorage.setItem('crypto_trades', JSON.stringify(trades)), [trades]);
  useEffect(() => localStorage.setItem('crypto_notes', JSON.stringify(dailyNotes)), [dailyNotes]);

  // --- 核心操作 ---
  const addTrade = (trade: TradeRecord) => {
    const tradeWithDate = { ...trade, dateStr: selectedDate };
    setTrades([tradeWithDate, ...trades]);
  };

  const updateDailySummary = (text: string) => {
    // 自动解析中文和英文标签 (#标签名)
    const tags = Array.from(new Set(Array.from(text.matchAll(/#([\u4e00-\u9fa5\w]+)/g)).map(match => match[1])));
    setDailyNotes(prev => ({
      ...prev,
      [selectedDate]: { dateStr: selectedDate, summary: text, tags }
    }));
  };

  // 生成 Markdown 报告
  const generateMarkdownReport = () => {
    const dayTrades = trades.filter(t => t.dateStr === selectedDate);
    const dayNote = dailyNotes[selectedDate] || { summary: '', tags: [] };
    
    let report = `# CryptoJournal 复盘报告 (${selectedDate})\n\n`;
    report += `## 今日心得\n${dayNote.summary || '未填写总结。'}\n\n`;
    
    if (dayNote.tags && dayNote.tags.length > 0) {
      report += `**标签**: ${dayNote.tags.map(t => `#${t}`).join(' ')}\n\n`;
    }

    report += `## 交易清单\n`;
    if (dayTrades.length === 0) {
      report += `今日无交易记录。\n`;
    } else {
      report += `| 币种 | 方向 | 类型 | 盈亏(U) | ROI | 备注 |\n`;
      report += `| --- | --- | --- | --- | --- | --- |\n`;
      dayTrades.forEach(t => {
        const sign = t.pnl >= 0 ? '+' : '';
        report += `| ${t.symbol} | ${t.direction === 'LONG' ? '多' : '空'} | ${t.type === 'FUTURES' ? t.leverage + 'x' : '现货'} | ${sign}${t.pnl.toFixed(2)} | ${t.roi.toFixed(2)}% | ${t.note || '-'} |\n`;
      });
      
      const totalPnL = dayTrades.reduce((a, b) => a + b.pnl, 0);
      report += `\n**当日累计盈亏**: ${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)} USDT\n`;
    }

    navigator.clipboard.writeText(report);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // --- 常用标签统计 ---
  const commonTags = useMemo(() => {
    const tagMap: Record<string, number> = {};
    // Fix: Cast Object.values to DailyNote[] to ensure 'note' has the correct type and fix property access errors
    (Object.values(dailyNotes) as DailyNote[]).forEach(note => {
      (note.tags || []).forEach(tag => {
        tagMap[tag] = (tagMap[tag] || 0) + 1;
      });
    });
    return Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15); // 取前15个最常用的
  }, [dailyNotes]);

  // --- 数据过滤逻辑 ---
  const filteredNoteTimeline = useMemo(() => {
    const allNotes = (Object.values(dailyNotes) as DailyNote[])
      .filter(n => n.summary.trim().length > 0)
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));

    const q = searchQuery.toLowerCase().trim();
    if (!q) return allNotes;

    // 如果搜索词是 # 开头，则专门搜标签
    if (q.startsWith('#')) {
      const tagName = q.slice(1);
      return allNotes.filter(n => (n.tags || []).some(t => t.toLowerCase() === tagName));
    }

    return allNotes.filter(n => 
      n.summary.toLowerCase().includes(q) || 
      n.dateStr.includes(q) ||
      (n.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }, [dailyNotes, searchQuery]);

  const filteredTrades = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const dayTrades = trades.filter(t => t.dateStr === selectedDate);
    
    if (!q || q.startsWith('#')) return dayTrades; // 标签搜索时，主要影响日记列表，流水保持当前日期或全部？这里设定为当前日期

    return trades.filter(t => 
      t.symbol.toLowerCase().includes(q) || 
      t.note.toLowerCase().includes(q)
    );
  }, [trades, selectedDate, searchQuery]);

  const handleTagClick = (tag: string) => {
    setSearchQuery(`#${tag}`);
    setActiveTab('timeline');
  };

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
            placeholder="搜索币种、内容或输入 #标签..."
            className="w-full bg-gray-900 border border-gray-800 rounded-full py-2 pl-12 pr-4 text-sm focus:outline-none focus:border-crypto-accent transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={16}/></button>}
        </div>

        <div className="flex items-center gap-4">
           <div className="text-right hidden sm:block">
              <p className="text-[10px] text-gray-500 font-bold uppercase">历史总盈亏</p>
              <p className={`text-sm font-mono font-black ${trades.reduce((a,b)=>a+b.pnl,0) >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                ${trades.reduce((a,b)=>a+b.pnl,0).toFixed(2)}
              </p>
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

          {/* 常用标签块 */}
          <div className="bg-crypto-card rounded-2xl border border-gray-800 p-5 shadow-xl">
             <div className="flex items-center gap-2 mb-4 text-gray-400 font-bold text-xs uppercase tracking-widest">
                <Tag size={14} className="text-crypto-accent" />
                常用标签
             </div>
             <div className="flex flex-wrap gap-2">
                {commonTags.length > 0 ? commonTags.map(([tag, count]) => (
                  <button 
                    key={tag} 
                    onClick={() => handleTagClick(tag)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${searchQuery === `#${tag}` ? 'bg-crypto-accent text-crypto-dark' : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                  >
                    <Hash size={10} />
                    {tag}
                    <span className="opacity-50 text-[10px]">{count}</span>
                  </button>
                )) : <span className="text-xs text-gray-600 italic">暂无常用标签</span>}
             </div>
          </div>

          <TradeCalculator onAddTrade={addTrade} />
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8">
          <div className="flex gap-2 mb-6 p-1 bg-gray-900 w-fit rounded-xl border border-gray-800">
            <button onClick={() => setActiveTab('daily')} className={`px-6 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'daily' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500'}`}><Activity size={14}/>当日复盘</button>
            <button onClick={() => setActiveTab('timeline')} className={`px-6 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'timeline' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500'}`}><List size={14}/>日记列表 {searchQuery && <span className="text-[10px] bg-crypto-accent/20 text-crypto-accent px-1 rounded ml-1">已筛选</span>}</button>
          </div>

          {activeTab === 'daily' ? (
            <div className="space-y-6">
              {/* 心得编辑区 */}
              <section className="bg-crypto-card p-6 rounded-2xl border border-gray-800 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><CalendarIcon size={18} className="text-indigo-400"/> {selectedDate} 交易复盘</h2>
                  <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                    {(dailyNotes[selectedDate]?.tags || []).map(t => (
                      <button key={t} onClick={() => handleTagClick(t)} className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[10px] font-bold hover:bg-indigo-500/20 transition-all">#{t}</button>
                    ))}
                  </div>
                </div>
                <textarea 
                  className="w-full h-40 bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-sm focus:outline-none focus:border-crypto-accent resize-none mb-4 font-normal leading-relaxed text-gray-300"
                  placeholder="总结今日的操盘逻辑、错误反思、情绪状态... (输入 #标签 自动关联)"
                  value={dailyNotes[selectedDate]?.summary || ''}
                  onChange={(e) => updateDailySummary(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <button 
                    onClick={generateMarkdownReport} 
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs font-bold text-white hover:bg-gray-700 transition-all active:scale-95"
                  >
                    {copySuccess ? <Check size={14} className="text-crypto-up"/> : <FileText size={14}/>}
                    {copySuccess ? '已复制 Markdown 报告' : '生成 Markdown 报告'}
                  </button>
                  <span className="text-[10px] text-gray-600 italic">自动保存到本地浏览器缓存</span>
                </div>
              </section>

              {/* 当日流水展示 */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                   <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><TrendingUp size={12}/> {selectedDate} 交易流水</h3>
                   <div className="text-[10px] font-mono text-gray-500">
                     盈利: <span className="text-crypto-up">${filteredTrades.filter(t=>t.pnl>0).reduce((a,b)=>a+b.pnl,0).toFixed(2)}</span> / 亏损: <span className="text-crypto-down">${filteredTrades.filter(t=>t.pnl<0).reduce((a,b)=>a+b.pnl,0).toFixed(2)}</span>
                   </div>
                </div>
                
                {filteredTrades.length === 0 ? (
                  <div className="text-center py-12 bg-crypto-card/30 rounded-2xl border border-dashed border-gray-800 text-gray-600 text-sm italic">
                    暂无交易数据，请使用计算器进行登记
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredTrades.map(trade => (
                      <div key={trade.id} className={`p-4 rounded-xl border transition-all group ${trade.status === 'HOLDING' ? 'bg-blue-900/10 border-blue-500/50' : 'bg-crypto-card border-gray-800 hover:border-gray-700'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{trade.symbol}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${trade.direction === 'LONG' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-rose-900/50 text-rose-400'}`}>
                                {trade.direction === 'LONG' ? '多' : '空'} {trade.type === 'FUTURES' ? `${trade.leverage}x` : '现货'}
                              </span>
                              {trade.status === 'HOLDING' && <span className="text-[9px] px-1.5 py-0.5 bg-blue-500 text-white rounded font-bold animate-pulse">持仓中</span>}
                          </div>
                          <span className={`text-sm font-mono font-bold ${trade.pnl >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                            {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-end">
                           <div className="space-y-1">
                              <p className="text-[10px] text-gray-500 font-mono">${trade.entryPrice.toLocaleString()} ➜ ${trade.exitPrice.toLocaleString()} ({trade.roi.toFixed(1)}%)</p>
                              <p className="text-[11px] text-gray-400 italic truncate max-w-[200px]">“{trade.note || '无备注'}”</p>
                           </div>
                           <button onClick={() => setTrades(trades.filter(t => t.id !== trade.id))} className="text-gray-700 hover:text-red-500 transition-colors p-1"><Trash2 size={12}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 日记列表流视图 (Timeline) */
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">共 {filteredNoteTimeline.length} 篇日记</span>
                {searchQuery && <button onClick={() => setSearchQuery('')} className="text-[10px] text-crypto-accent hover:underline flex items-center gap-1"><X size={10}/> 清除筛选</button>}
              </div>

              {filteredNoteTimeline.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-800 rounded-3xl bg-crypto-card/10">
                   <MessageSquare size={40} className="mb-2 opacity-20"/>
                   <p className="text-sm">未找到匹配的日记内容</p>
                </div>
              ) : (
                filteredNoteTimeline.map(note => (
                  <div key={note.dateStr} onClick={() => { setSelectedDate(note.dateStr); setActiveTab('daily'); }} 
                    className="bg-crypto-card p-5 rounded-2xl border border-gray-800 hover:border-crypto-accent/50 transition-all cursor-pointer group relative overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-white">{note.dateStr}</span>
                        <div className="flex gap-1 flex-wrap">
                          {note.tags.map(t => (
                            <span key={t} onClick={(e) => { e.stopPropagation(); handleTagClick(t); }} className="text-[9px] bg-gray-900 text-gray-500 px-1.5 py-0.5 rounded border border-gray-800 hover:text-crypto-accent hover:border-crypto-accent/50 transition-all">#{t}</span>
                          ))}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-gray-700 group-hover:text-crypto-accent transition-colors"/>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed mb-4">
                      {note.summary}
                    </p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800/50">
                       <div className="flex gap-4 text-[10px] text-gray-600 font-bold uppercase tracking-tighter">
                          <span>成交笔数: {trades.filter(t => t.dateStr === note.dateStr).length}</span>
                          <span>当日盈亏: <span className={trades.filter(t=>t.dateStr===note.dateStr).reduce((a,b)=>a+b.pnl,0) >= 0 ? 'text-crypto-up' : 'text-crypto-down'}>
                            ${trades.filter(t=>t.dateStr===note.dateStr).reduce((a,b)=>a+b.pnl,0).toFixed(2)}
                          </span></span>
                       </div>
                       <div className="h-1 flex-1 mx-4 bg-gray-900 rounded-full overflow-hidden">
                          {(() => {
                            const dayTrades = trades.filter(t => t.dateStr === note.dateStr);
                            const wins = dayTrades.filter(t => t.pnl > 0).length;
                            const total = dayTrades.length;
                            const winRate = total > 0 ? (wins / total) * 100 : 0;
                            return <div className="h-full bg-crypto-up" style={{ width: `${winRate}%` }}></div>
                          })()}
                       </div>
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
