
import React, { useState, useEffect, useMemo, useRef } from 'react';
import TradeCalculator from './components/TradeCalculator';
import Calendar from './components/Calendar';
import CryptoTicker from './components/CryptoTicker';
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
  Tag,
  Download,
  Upload,
  Database,
  Share2
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => localStorage.setItem('crypto_trades', JSON.stringify(trades)), [trades]);
  useEffect(() => localStorage.setItem('crypto_notes', JSON.stringify(dailyNotes)), [dailyNotes]);

  // --- 核心操作 ---
  const addTrade = (trade: TradeRecord) => {
    const tradeWithDate = { ...trade, dateStr: selectedDate };
    setTrades([tradeWithDate, ...trades]);
  };

  const updateDailySummary = (text: string) => {
    // 匹配中文及常规字符标签
    const tags = Array.from(new Set(Array.from(text.matchAll(/#([\u4e00-\u9fa5\w\d_-]+)/g)).map(match => match[1])));
    setDailyNotes(prev => ({
      ...prev,
      [selectedDate]: { dateStr: selectedDate, summary: text, tags }
    }));
  };

  // --- 备份导出 (JSON) ---
  const handleExportData = () => {
    try {
      const data = {
        trades,
        dailyNotes,
        exportAt: new Date().toISOString(),
        appName: "CryptoLog",
        version: "1.1"
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `币圈日记备份_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('导出备份文件失败');
    }
  };

  // --- 备份导入 (JSON) ---
  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.trades && Array.isArray(json.trades) && json.dailyNotes) {
          if (window.confirm('警告：导入备份将覆盖您目前所有的本地记录。是否确认恢复？')) {
            setTrades(json.trades);
            setDailyNotes(json.dailyNotes);
            alert('数据恢复成功！');
          }
        } else {
          alert('导入失败：文件格式不受支持。');
        }
      } catch (err) {
        alert('读取备份文件失败，请确保文件未损坏。');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- 生成 Markdown 报告 ---
  const generateMarkdownReport = () => {
    const dayTrades = trades.filter(t => t.dateStr === selectedDate);
    const dayNote = dailyNotes[selectedDate] || { summary: '', tags: [] };
    
    let report = `## CryptoLog 交易复盘报告 (${selectedDate})\n\n`;
    report += `### 📝 今日心得总结\n${dayNote.summary || '今日未记录心得。'}\n\n`;
    
    if (dayNote.tags && dayNote.tags.length > 0) {
      report += `**🏷️ 标签**: ${dayNote.tags.map(t => `#${t}`).join(' ')}\n\n`;
    }

    report += `### 📊 成交清单\n`;
    if (dayTrades.length === 0) {
      report += `> 今日无记录流水。\n`;
    } else {
      report += `| 币种 | 方向 | 详情 | 盈亏(U) | ROI | 备注 |\n`;
      report += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      dayTrades.forEach(t => {
        const sign = t.pnl >= 0 ? '🟢 +' : '🔴 ';
        report += `| ${t.symbol} | ${t.direction === 'LONG' ? '看多' : '看空'} | ${t.type === 'FUTURES' ? t.leverage + 'x' : '现货'} | ${sign}${t.pnl.toFixed(2)} | ${t.roi.toFixed(2)}% | ${t.note || '-'} |\n`;
      });
      
      const totalPnL = dayTrades.reduce((a, b) => a + b.pnl, 0);
      report += `\n**💰 当日累计利润**: ${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)} USDT\n`;
    }

    navigator.clipboard.writeText(report);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // --- 标签热度统计 ---
  const commonTags = useMemo(() => {
    const tagMap: Record<string, number> = {};
    (Object.values(dailyNotes) as DailyNote[]).forEach(note => {
      (note.tags || []).forEach(tag => {
        tagMap[tag] = (tagMap[tag] || 0) + 1;
      });
    });
    return Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [dailyNotes]);

  // --- 过滤展示逻辑 ---
  const filteredNoteTimeline = useMemo(() => {
    const allNotes = (Object.values(dailyNotes) as DailyNote[])
      .filter(n => n.summary.trim().length > 0)
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));

    const q = searchQuery.toLowerCase().trim();
    if (!q) return allNotes;

    if (q.startsWith('#')) {
      const tagName = q.slice(1);
      return allNotes.filter(n => (n.tags || []).some(t => t.toLowerCase().includes(tagName)));
    }

    return allNotes.filter(n => 
      n.summary.toLowerCase().includes(q) || n.dateStr.includes(q) || (n.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }, [dailyNotes, searchQuery]);

  const filteredTrades = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const dayTrades = trades.filter(t => t.dateStr === selectedDate);
    if (!q || q.startsWith('#')) return dayTrades;
    return trades.filter(t => t.symbol.toLowerCase().includes(q) || t.note.toLowerCase().includes(q));
  }, [trades, selectedDate, searchQuery]);

  const handleTagClick = (tag: string) => {
    setSearchQuery(`#${tag}`);
    setActiveTab('timeline');
  };

  const totalHistoricalPnl = useMemo(() => trades.reduce((a, b) => a + b.pnl, 0), [trades]);

  return (
    <div className="min-h-screen bg-crypto-dark text-gray-200 selection:bg-crypto-accent/30 flex flex-col font-sans">
      <CryptoTicker />

      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 bg-crypto-dark/80 backdrop-blur-md border-b border-gray-800 px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-crypto-accent rounded-xl text-crypto-dark shadow-lg shadow-crypto-accent/20">
            <NotebookPen size={20} />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-white uppercase select-none">
            CRYPTO<span className="text-crypto-accent italic">LOG</span>
          </h1>
        </div>

        <div className="flex-1 max-w-lg mx-8 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="text" 
            placeholder="搜索内容或使用 #标签 筛选..."
            className="w-full bg-gray-900/50 border border-gray-800 rounded-full py-2 pl-12 pr-4 text-sm focus:outline-none focus:border-crypto-accent focus:bg-gray-900 transition-all text-gray-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={16}/></button>}
        </div>

        <div className="flex items-center gap-6">
           <div className="text-right hidden md:block">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">历史总盈亏</p>
              <p className={`text-lg font-mono font-black ${totalHistoricalPnl >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                ${totalHistoricalPnl.toFixed(2)}
              </p>
           </div>
        </div>
      </header>

      {/* 三列主布局 */}
      <main className="max-w-[1600px] mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 items-start">
        
        {/* LEFT COLUMN: 登记工具 (3 Units) */}
        <aside className="lg:col-span-3 space-y-6 order-2 lg:order-1">
          <div className="sticky top-24">
            <TradeCalculator onAddTrade={addTrade} />
            <div className="mt-6 p-4 bg-crypto-card/30 rounded-2xl border border-gray-800/50 text-center">
               <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em] mb-1">Trading Log Assistant</p>
               <p className="text-[9px] text-gray-700 italic">所有数据仅加密存储于浏览器本地缓存</p>
            </div>
          </div>
        </aside>

        {/* MIDDLE COLUMN: 复盘 & 日记 (6 Units) */}
        <section className="lg:col-span-6 space-y-6 order-1 lg:order-2">
          {/* 选项卡切换 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-2 p-1 bg-gray-900 w-fit rounded-xl border border-gray-800">
              <button 
                onClick={() => setActiveTab('daily')} 
                className={`px-8 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'daily' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <Activity size={14}/>当日复盘
              </button>
              <button 
                onClick={() => setActiveTab('timeline')} 
                className={`px-8 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'timeline' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <List size={14}/>全部记录
              </button>
            </div>
            {activeTab === 'timeline' && searchQuery && (
               <span className="text-[10px] font-bold text-crypto-accent uppercase bg-crypto-accent/10 px-2 py-1 rounded">筛选生效中</span>
            )}
          </div>

          {activeTab === 'daily' ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* 复盘心得编辑 */}
              <div className="bg-crypto-card p-6 rounded-3xl border border-gray-800 shadow-2xl relative">
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                    <h2 className="text-xl font-bold text-white tracking-tight">{selectedDate} 复盘反思</h2>
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-end max-w-[200px]">
                    {(dailyNotes[selectedDate]?.tags || []).map(t => (
                      <button key={t} onClick={() => handleTagClick(t)} className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[10px] font-bold hover:bg-indigo-500/20 transition-all">#{t}</button>
                    ))}
                  </div>
                </div>
                <textarea 
                  className="w-full h-56 bg-gray-900/50 border border-gray-800 rounded-2xl p-5 text-sm focus:outline-none focus:border-crypto-accent resize-none mb-5 font-normal leading-relaxed text-gray-300 placeholder:text-gray-600 shadow-inner"
                  placeholder="请输入今日的操盘心得、逻辑判断或反思总结... (例如：#左侧交易 #止损反思)"
                  value={dailyNotes[selectedDate]?.summary || ''}
                  onChange={(e) => updateDailySummary(e.target.value)}
                />
                <div className="flex items-center justify-between border-t border-gray-800/50 pt-5">
                  <button 
                    onClick={generateMarkdownReport} 
                    className="group flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-black text-white transition-all shadow-lg shadow-indigo-900/20 active:scale-95"
                  >
                    {copySuccess ? <Check size={14} className="animate-bounce"/> : <Share2 size={14} className="group-hover:rotate-12 transition-transform"/>}
                    {copySuccess ? 'MARKDOWN 已复制' : '复制复盘报告 (MD)'}
                  </button>
                  <div className="flex items-center gap-2 text-gray-500 select-none">
                    <Check size={14} className="text-crypto-up" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">实时存档已就绪</span>
                  </div>
                </div>
              </div>

              {/* 当日流水记录 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                   <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                     <TrendingUp size={12}/> 当日成交明细
                   </h3>
                   {filteredTrades.length > 0 && (
                     <div className="text-[10px] font-mono text-gray-500">
                        COUNT: {filteredTrades.length}
                     </div>
                   )}
                </div>
                
                {filteredTrades.length === 0 ? (
                  <div className="text-center py-20 bg-crypto-card/10 rounded-3xl border-2 border-dashed border-gray-800 text-gray-600 text-sm font-medium">
                    今日暂无已记录的流水
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredTrades.map(trade => (
                      <div key={trade.id} className={`p-5 rounded-2xl border transition-all ${trade.status === 'HOLDING' ? 'bg-blue-900/10 border-blue-500/40' : 'bg-crypto-card border-gray-800 hover:border-gray-700 shadow-sm'}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-4">
                              <span className="font-black text-white text-base tracking-tight">{trade.symbol}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-black ${trade.direction === 'LONG' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-rose-900/50 text-rose-400'}`}>
                                {trade.direction === 'LONG' ? '多' : '空'} {trade.type === 'FUTURES' ? `${trade.leverage}x` : '现货'}
                              </span>
                              {trade.status === 'HOLDING' && (
                                <span className="text-[9px] px-2 py-0.5 bg-blue-500 text-white rounded font-bold uppercase tracking-widest animate-pulse">持仓</span>
                              )}
                          </div>
                          <div className="text-right">
                             <div className={`text-base font-mono font-black ${trade.pnl >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                                {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                             </div>
                             <div className="text-[10px] text-gray-500 font-mono font-bold uppercase">ROI: {trade.roi.toFixed(2)}%</div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-gray-800/30 pt-3">
                           <p className="text-xs text-gray-400 italic truncate max-w-[85%]">“{trade.note || '未添加备注'}”</p>
                           <button 
                             onClick={() => setTrades(trades.filter(t => t.id !== trade.id))} 
                             className="text-gray-700 hover:text-red-500 transition-colors"
                             title="删除此笔记录"
                           >
                             <Trash2 size={14}/>
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 时间轴视图 */
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              {filteredNoteTimeline.length === 0 ? (
                <div className="h-80 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-800 rounded-[2.5rem] bg-crypto-card/10">
                   <MessageSquare size={48} className="mb-4 opacity-10"/>
                   <p className="text-sm font-bold uppercase tracking-widest">NO RECORDS FOUND</p>
                </div>
              ) : (
                filteredNoteTimeline.map(note => (
                  <div 
                    key={note.dateStr} 
                    onClick={() => { setSelectedDate(note.dateStr); setActiveTab('daily'); }} 
                    className="bg-crypto-card p-6 rounded-3xl border border-gray-800 hover:border-crypto-accent/40 transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-black text-white">{note.dateStr}</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {note.tags.map(t => (
                            <span key={t} className="text-[10px] bg-gray-900 text-gray-500 px-2 py-0.5 rounded-lg border border-gray-800 font-bold">#{t}</span>
                          ))}
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-gray-700 group-hover:text-crypto-accent group-hover:translate-x-1 transition-all"/>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed font-normal">
                      {note.summary}
                    </p>
                    <div className="flex items-center gap-4 mt-5 pt-4 border-t border-gray-800/50">
                       <div className="flex gap-4 text-[11px] text-gray-500 font-bold uppercase tracking-tighter">
                          <span>流水笔数: <span className="text-gray-300">{trades.filter(t => t.dateStr === note.dateStr).length}</span></span>
                          <span>当日盈亏: <span className={trades.filter(t=>t.dateStr===note.dateStr).reduce((a,b)=>a+b.pnl,0) >= 0 ? 'text-crypto-up' : 'text-crypto-down'}>
                            ${trades.filter(t=>t.dateStr===note.dateStr).reduce((a,b)=>a+b.pnl,0).toFixed(2)}
                          </span></span>
                       </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: 辅助工具 & 数据管理 (3 Units) */}
        <aside className="lg:col-span-3 space-y-6 order-3">
          
          {/* 数据存档管理 */}
          <div className="bg-gradient-to-br from-crypto-card to-gray-950 rounded-3xl border border-gray-700/60 p-6 shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
               <Database size={64}/>
             </div>
             <div className="flex items-center gap-2 mb-5 text-white font-black text-xs uppercase tracking-[0.2em]">
                <Database size={16} className="text-crypto-accent" />
                数据管家
             </div>
             <div className="flex flex-col gap-3">
                <button 
                  onClick={handleExportData} 
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800/80 border border-gray-700 hover:border-crypto-accent/50 rounded-2xl text-xs font-bold text-white hover:bg-gray-800 transition-all active:scale-95"
                >
                  <Download size={14} /> 备份数据为 JSON
                </button>
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleImportData} 
                    ref={fileInputRef} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800/80 border border-gray-700 hover:border-crypto-accent/50 rounded-2xl text-xs font-bold text-white hover:bg-gray-800 transition-all">
                    <Upload size={14} /> 恢复备份文件
                  </button>
                </div>
             </div>
             <p className="mt-4 text-[9px] text-gray-600 font-bold uppercase text-center tracking-widest">Data Management</p>
          </div>

          {/* 日历组件 */}
          <div className="bg-crypto-card rounded-3xl border border-gray-800 p-5 shadow-xl">
            <Calendar 
              trades={trades} 
              dailyNotes={dailyNotes} 
              selectedDate={selectedDate} 
              onSelectDate={(d) => { setSelectedDate(d); setActiveTab('daily'); }} 
            />
          </div>

          {/* 常用标签库 */}
          <div className="bg-crypto-card rounded-3xl border border-gray-800 p-6 shadow-xl relative overflow-hidden">
             <div className="flex items-center gap-2 mb-5 text-gray-400 font-black text-[10px] uppercase tracking-[0.2em]">
                <Tag size={16} className="text-crypto-accent" />
                热搜标签库
             </div>
             <div className="flex flex-wrap gap-2">
                {commonTags.length > 0 ? commonTags.map(([tag, count]) => (
                  <button 
                    key={tag} 
                    onClick={() => handleTagClick(tag)} 
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 ${searchQuery === `#${tag}` ? 'bg-crypto-accent text-crypto-dark shadow-lg shadow-crypto-accent/20' : 'bg-gray-900/50 text-gray-400 hover:text-white border border-gray-800'}`}
                  >
                    <Hash size={10} /> 
                    {tag} 
                    <span className="opacity-40 text-[9px] font-mono">{count}</span>
                  </button>
                )) : (
                  <span className="text-xs text-gray-600 italic py-4 w-full text-center">尚未记录任何标签</span>
                )}
             </div>
          </div>
        </aside>

      </main>

      {/* 底部版权信息 */}
      <footer className="py-6 border-t border-gray-800/50 text-center">
        <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.5em] opacity-50">
          CRYPTO LOG • TRACK • ANALYZE • GROW
        </p>
      </footer>
    </div>
  );
};

export default App;
