import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import TradeCalculator from './components/TradeCalculator';
import Calendar from './components/Calendar';
import { TradeRecord, DailyNote, CryptoPrice } from './types';
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
  Share2,
  Sparkles,
  TrendingDown,
  RefreshCw,
  Percent,
  CheckCircle,
  AlertTriangle,
  Coins,
  Link,
  Key
} from 'lucide-react';

interface AdvisorResponse {
  summary: string;
  levels: {
    conservativeTP: { price: number; percent: number; reason: string };
    moderateTP: { price: number; percent: number; reason: string };
    aggressiveTP: { price: number; percent: number; reason: string };
    stopLoss: { price: number; percent: number; reason: string };
  };
  riskReward: string;
  technicalIndicators: string[];
  tacticalAdvice: string;
}

const App: React.FC = () => {
  // --- 数据持久化 ---
  const [trades, setTrades] = useState<TradeRecord[]>(() => JSON.parse(localStorage.getItem('crypto_trades') || '[]'));
  const [dailyNotes, setDailyNotes] = useState<Record<string, DailyNote>>(() => JSON.parse(localStorage.getItem('crypto_notes') || '{}'));

  // --- UI 状态 ---
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'daily' | 'holdings' | 'timeline' | 'analytics'>('daily');
  const [copySuccess, setCopySuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 仓位风控计算器 状态 ---
  const [riskBalance, setRiskBalance] = useState<number>(2000);
  const [riskPercent, setRiskPercent] = useState<number>(2); // 2% 风险敞口
  const [stopLossGap, setStopLossGap] = useState<number>(5);  // 5% 止损跨度
  const [riskLeverage, setRiskLeverage] = useState<number>(10); // 10x 默认杠杆

  // --- 行情与持仓价格自定义 状态 ---
  const [availableCoins, setAvailableCoins] = useState<CryptoPrice[]>([]);
  const [apiError, setApiError] = useState(false);
  const [isRefreshingCoins, setIsRefreshingCoins] = useState(false);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});

  // --- AI 止盈止损顾问 状态 ---
  const [advisorAdvice, setAdvisorAdvice] = useState<Record<string, AdvisorResponse>>({});
  const [loadingAdvisorId, setLoadingAdvisorId] = useState<string | null>(null);
  const [advisorError, setAdvisorError] = useState<string | null>(null);

  // --- 结算弹出 状态 ---
  const [settlingTradeId, setSettlingTradeId] = useState<string | null>(null);
  const [settlementPrice, setSettlementPrice] = useState<string>('');

  useEffect(() => localStorage.setItem('crypto_trades', JSON.stringify(trades)), [trades]);
  useEffect(() => localStorage.setItem('crypto_notes', JSON.stringify(dailyNotes)), [dailyNotes]);

  // --- 币安 API 同步与交易笔记状态 ---
  const [binanceApiKey, setBinanceApiKey] = useState<string>(() => localStorage.getItem('binance_api_key') || '');
  const [binanceSecretKey, setBinanceSecretKey] = useState<string>(() => localStorage.getItem('binance_secret_key') || '');
  const [binanceSymbol, setBinanceSymbol] = useState<string>('BTCUSDT');
  const [binanceType, setBinanceType] = useState<'SPOT' | 'FUTURES'>('SPOT');
  const [binanceTrades, setBinanceTrades] = useState<any[]>([]);
  const [isBinanceSyncing, setIsBinanceSyncing] = useState(false);
  const [binanceError, setBinanceError] = useState<string | null>(null);
  const [binanceSuccessMsg, setBinanceSuccessMsg] = useState<string | null>(null);
  const [binanceTradeNotes, setBinanceTradeNotes] = useState<Record<string, string>>({});
  const [binanceTradeStatus, setBinanceTradeStatus] = useState<Record<string, 'HOLDING' | 'CLOSED'>>({});

  useEffect(() => {
    localStorage.setItem('binance_api_key', binanceApiKey);
    localStorage.setItem('binance_secret_key', binanceSecretKey);
  }, [binanceApiKey, binanceSecretKey]);

  // --- 币安 API 同步与成交笔记生成方法 ---
  const fetchBinanceTrades = async () => {
    if (!binanceApiKey.trim() || !binanceSecretKey.trim()) {
      setBinanceError('请先在本板块填写您的币安 API Key 与 Secret Key！');
      return;
    }
    setIsBinanceSyncing(true);
    setBinanceError(null);
    setBinanceSuccessMsg(null);
    try {
      const res = await fetch('/api/binance/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: binanceApiKey.trim(),
          secretKey: binanceSecretKey.trim(),
          type: binanceType,
          symbol: binanceSymbol.toUpperCase().trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `请求失败，服务器返回状态 ${res.status}`);
      }

      if (Array.isArray(data)) {
        setBinanceTrades(data);
        setBinanceSuccessMsg(`成功同步 ${data.length} 笔最新成交记录`);
        const initStatus: Record<string, 'HOLDING' | 'CLOSED'> = {};
        data.forEach((t: any) => {
          const id = String(t.id);
          if (binanceType === 'SPOT') {
            initStatus[id] = 'CLOSED';
          } else {
            const pnlVal = parseFloat(t.realizedPnl || '0');
            initStatus[id] = pnlVal !== 0 ? 'CLOSED' : 'HOLDING';
          }
        });
        setBinanceTradeStatus(initStatus);
      } else {
        throw new Error('未查询到对应的成交记录，可能当前币种在此密钥账户下近期无成交，或格式错误');
      }
    } catch (err: any) {
      console.error(err);
      setBinanceError(err.message || '网络连接或 API 签名校验失败。如有 IP 绑定限制，请关闭该 IP 校验并放开免签。');
    } finally {
      setIsBinanceSyncing(false);
    }
  };

  const importBinanceTrade = (bTrade: any) => {
    const tradeId = String(bTrade.id);
    const customNote = binanceTradeNotes[tradeId] || '';
    const chosenStatus = binanceTradeStatus[tradeId] || 'CLOSED';

    const timeMs = bTrade.time;
    const tradeDateStr = new Date(timeMs).toISOString().split('T')[0];

    const price = parseFloat(bTrade.price) || 0;
    const qty = parseFloat(bTrade.qty) || 0;
    
    let direction: PositionDirection = 'LONG';
    let pnl = 0;
    let amount = 0;

    if (binanceType === 'SPOT') {
      amount = parseFloat(bTrade.quoteQty) || (price * qty);
      direction = bTrade.isBuyer ? 'LONG' : 'SHORT';
      pnl = 0;
    } else {
      amount = price * qty;
      direction = bTrade.positionSide === 'SHORT' || bTrade.side === 'SELL' ? 'SHORT' : 'LONG';
      pnl = parseFloat(bTrade.realizedPnl) || 0;
    }

    const roi = (amount > 0) ? (pnl / amount) * 100 : 0;

    const newRecord: TradeRecord = {
      id: `binance-${tradeId}`,
      coinId: binanceSymbol.toLowerCase().replace('usdt', ''),
      symbol: binanceSymbol.toUpperCase(),
      type: binanceType,
      direction,
      status: chosenStatus,
      entryPrice: price,
      exitPrice: price,
      amount,
      leverage: binanceType === 'FUTURES' ? 10 : 1,
      pnl,
      roi,
      note: customNote || `币安 API 同步导入 | ID: ${tradeId}`,
      timestamp: timeMs,
      dateStr: tradeDateStr,
      quantity: qty
    };

    if (trades.some(t => t.id === newRecord.id)) {
      alert('⚠️ 该笔成交记录已存在于您的流水日志中，请勿重复导入！');
      return;
    }

    setTrades(prev => [newRecord, ...prev]);

    // Update Daily note with this transaction note, allowing them to form comprehensive trading notes:
    if (customNote.trim()) {
      const existingNote = dailyNotes[tradeDateStr];
      const noteHeader = `\n[币安交易回顾 ${new Date(timeMs).toLocaleTimeString()}] (${binanceSymbol}): ${customNote}`;
      const newSummary = existingNote 
        ? `${existingNote.summary}${noteHeader}`
        : `「币安成交日记归档」${noteHeader}`;
      
      const tags = Array.from(new Set(Array.from(newSummary.matchAll(/#([\u4e00-\u9fa5\w\d_-]+)/g)).map(match => match[1])));
      setDailyNotes(prev => ({
        ...prev,
        [tradeDateStr]: { dateStr: tradeDateStr, summary: newSummary, tags }
      }));
    }

    alert('✅ 成功导入至本地流水！已在您的交易笔记中留下印记。');
  };

  // --- 获取 CoinGecko 实时排行数据 ---
  const fetchCoinList = useCallback(async () => {
    setIsRefreshingCoins(true);
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250', {
          headers: { 'Accept': 'application/json' }
      });
      if (res.status === 429) throw new Error('Rate limit');
      const data = await res.json();
      if (Array.isArray(data)) {
        setAvailableCoins(data);
        setApiError(false);
      }
    } catch (err) {
      setApiError(true);
      if (availableCoins.length === 0) {
        // Fallback fallback default prices
        setAvailableCoins([
          { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 96000, price_change_percentage_24h: 1.2 },
          { id: 'ethereum', symbol: 'eth', name: 'Ethereum', current_price: 3300, price_change_percentage_24h: -0.5 },
          { id: 'solana', symbol: 'sol', name: 'Solana', current_price: 180, price_change_percentage_24h: 3.4 },
          { id: 'binancecoin', symbol: 'bnb', name: 'BNB', current_price: 600, price_change_percentage_24h: 0.8 },
          { id: 'ripple', symbol: 'xrp', name: 'XRP', current_price: 2.2, price_change_percentage_24h: 12.5 },
        ]);
      }
    } finally {
      setIsRefreshingCoins(false);
    }
  }, [availableCoins.length]);

  useEffect(() => {
    fetchCoinList();
    const interval = setInterval(fetchCoinList, 180000); // 每3分钟自动拉取
    return () => clearInterval(interval);
  }, [fetchCoinList]);

  // --- 核心操作 ---
  const addTrade = (trade: TradeRecord) => {
    const tradeWithDate = { ...trade, dateStr: selectedDate };
    setTrades([tradeWithDate, ...trades]);
  };

  const updateDailySummary = (text: string) => {
    const tags = Array.from(new Set(Array.from(text.matchAll(/#([\u4e00-\u9fa5\w\d_-]+)/g)).map(match => match[1])));
    setDailyNotes(prev => ({
      ...prev,
      [selectedDate]: { dateStr: selectedDate, summary: text, tags }
    }));
  };

  const handleExportData = () => {
    try {
      const data = {
        trades,
        dailyNotes,
        exportAt: new Date().toISOString(),
        appName: "CryptoLog",
        version: "1.2"
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
          alert('导入失败：格式有误。');
        }
      } catch (err) {
        alert('读取备份文件失败。');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

  // --- 获取 AI 止盈止损建议 ---
  const getAIAdvice = async (trade: TradeRecord, coinPrice: number) => {
    setLoadingAdvisorId(trade.id);
    setAdvisorError(null);
    try {
      const response = await fetch('/api/gemini/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: trade.symbol,
          type: trade.type,
          direction: trade.direction,
          entryPrice: trade.entryPrice,
          currentPrice: coinPrice,
          amount: trade.amount,
          leverage: trade.leverage,
          note: trade.note
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '获取AI决策建议失败');
      }

      const data = await response.json();
      setAdvisorAdvice(prev => ({ ...prev, [trade.id]: data }));
    } catch (err: any) {
      console.error(err);
      setAdvisorError(err.message || '模型响应超时，或请先配置 GEMINI_API_KEY。');
    } finally {
      setLoadingAdvisorId(null);
    }
  };

  // --- 结算/平仓操作 ---
  const triggerSettleTrade = (trade: TradeRecord, currentEstimatedPrice: number) => {
    setSettlingTradeId(trade.id);
    setSettlementPrice(currentEstimatedPrice.toString());
  };

  const executeSettleTrade = (tradeId: string) => {
    const trade = trades.find(t => t.id === tradeId);
    if (!trade) return;
    
    const finalPrice = parseFloat(settlementPrice);
    if (isNaN(finalPrice) || finalPrice <= 0) {
      alert('请输入有效的结算/平仓价格');
      return;
    }

    const entry = trade.entryPrice;
    const lev = trade.type === 'SPOT' ? 1 : trade.leverage;
    const size = trade.type === 'SPOT' ? trade.amount : trade.amount * lev;
    const coinAmount = trade.quantity || (size / entry);
    const finalPnl = trade.direction === 'LONG' ? (finalPrice - entry) * coinAmount : (entry - finalPrice) * coinAmount;
    const finalRoi = (trade.amount > 0) ? (finalPnl / trade.amount) * 100 : 0;

    setTrades(prev => prev.map(t => {
      if (t.id === tradeId) {
        return {
          ...t,
          status: 'CLOSED' as const,
          exitPrice: finalPrice,
          pnl: finalPnl,
          roi: finalRoi,
          dateStr: selectedDate // 在今日复盘日记对应的日期下结算结案
        };
      }
      return t;
    }));

    setSettlingTradeId(null);
    setSettlementPrice('');
    alert('该笔持仓已成功闭环平仓，实际产生的收益已经安全记入您的日志中！');
  };

  const commonTags = useMemo(() => {
    const tagMap: Record<string, number> = {};
    (Object.values(dailyNotes) as DailyNote[]).forEach(note => {
      (note.tags || []).forEach(tag => {
        tagMap[tag] = (tagMap[tag] || 0) + 1;
      });
    });
    return Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [dailyNotes]);

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

  // 当日成交明细
  const filteredTrades = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const dayTrades = trades.filter(t => t.dateStr === selectedDate);
    if (!q || q.startsWith('#')) return dayTrades;
    return trades.filter(t => t.symbol.toLowerCase().includes(q) || t.note.toLowerCase().includes(q));
  }, [trades, selectedDate, searchQuery]);

  // 从 trades 中过滤活跃持仓 (HOLDING status)
  const activeHoldings = useMemo(() => {
    return trades.filter(t => t.status === 'HOLDING');
  }, [trades]);

  // 整理持仓统计指标
  const holdingsStats = useMemo(() => {
    let totalMargin = 0;
    let totalFloatingPnL = 0;
    let bestHoldingPnL = -999999;
    let bestSymbol = '无';

    activeHoldings.forEach(trade => {
      totalMargin += trade.amount;
      
      // 读取最新的币价
      const marketCoin = availableCoins.find(c => c.symbol.toLowerCase() === trade.symbol.toLowerCase());
      const customPrice = customPrices[trade.id];
      const currentPrice = customPrice !== undefined ? customPrice : (marketCoin?.current_price || trade.entryPrice);
      
      // 盈亏计算
      const entry = trade.entryPrice;
      const lev = trade.type === 'SPOT' ? 1 : trade.leverage;
      const size = trade.type === 'SPOT' ? trade.amount : trade.amount * lev;
      const coinAmount = trade.quantity || (size / entry);
      const pnl = trade.direction === 'LONG' ? (currentPrice - entry) * coinAmount : (entry - currentPrice) * coinAmount;
      
      totalFloatingPnL += pnl;

      if (pnl > bestHoldingPnL) {
        bestHoldingPnL = pnl;
        bestSymbol = trade.symbol.toUpperCase();
      }
    });

    return {
      totalMargin,
      totalFloatingPnL,
      bestSymbol: totalMargin > 0 && bestHoldingPnL > -999999 ? `${bestSymbol} (+$${bestHoldingPnL.toFixed(1)})` : '暂无'
    };
  }, [activeHoldings, availableCoins, customPrices]);

  const handleTagClick = (tag: string) => {
    setSearchQuery(`#${tag}`);
    setActiveTab('timeline');
  };

  const totalHistoricalPnl = useMemo(() => trades.reduce((a, b) => a + b.pnl, 0), [trades]);

  // --- 交易科学量化统计运算 ---
  const quantStats = useMemo(() => {
    const closed = trades.filter(t => t.status === 'CLOSED');
    const totalCount = closed.length;
    if (totalCount === 0) {
      return {
        totalCount: 0,
        winRate: 0,
        profitFactor: 0,
        totalProfit: 0,
        totalLoss: 0,
        avgWin: 0,
        avgLoss: 0,
        longCount: 0,
        shortCount: 0,
        longWinRate: 0,
        shortWinRate: 0,
        futuresRatio: 0,
        troubleTags: [],
        profitTags: []
      };
    }

    const wins = closed.filter(t => t.pnl > 0);
    const losses = closed.filter(t => t.pnl <= 0);
    const winCount = wins.length;
    const lossCount = losses.length;
    const winRate = (winCount / totalCount) * 100;

    const totalProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLoss === 0 ? (totalProfit > 0 ? 999 : 0) : totalProfit / totalLoss;

    const avgWin = winCount > 0 ? totalProfit / winCount : 0;
    const avgLoss = lossCount > 0 ? totalLoss / lossCount : 0;

    const longs = closed.filter(t => t.direction === 'LONG');
    const shorts = closed.filter(t => t.direction === 'SHORT');
    const longCount = longs.length;
    const shortCount = shorts.length;

    const longWins = longs.filter(t => t.pnl > 0).length;
    const shortWins = shorts.filter(t => t.pnl > 0).length;
    const longWinRate = longCount > 0 ? (longWins / longCount) * 100 : 0;
    const shortWinRate = shortCount > 0 ? (shortWins / shortCount) * 100 : 0;

    const futuresCount = closed.filter(t => t.type === 'FUTURES').length;
    const futuresRatio = (futuresCount / totalCount) * 100;

    // 心态标签关联盈亏分析
    const tagAnalysis: Record<string, { pnl: number; count: number; wins: number }> = {};
    closed.forEach(trade => {
      // 提取 trade.note 中的 #标签
      const noteTags = Array.from(new Set(Array.from(trade.note.matchAll(/#([\u4e00-\u9fa5\w\d_-]+)/g)).map(match => match[1])));
      noteTags.forEach(tag => {
        if (!tagAnalysis[tag]) {
          tagAnalysis[tag] = { pnl: 0, count: 0, wins: 0 };
        }
        tagAnalysis[tag].pnl += trade.pnl;
        tagAnalysis[tag].count += 1;
        if (trade.pnl > 0) tagAnalysis[tag].wins += 1;
      });
    });

    const TroubleTagsList = Object.entries(tagAnalysis)
      .map(([tag, val]) => ({ tag, pnl: val.pnl, count: val.count, winRate: (val.wins / val.count) * 100 }))
      .filter(item => item.pnl < 0)
      .sort((a, b) => a.pnl - b.pnl); // 亏损最多的在最前

    const ProfitTagsList = Object.entries(tagAnalysis)
      .map(([tag, val]) => ({ tag, pnl: val.pnl, count: val.count, winRate: (val.wins / val.count) * 100 }))
      .filter(item => item.pnl > 0)
      .sort((a, b) => b.pnl - a.pnl); // 盈利最多的在最前

    return {
      totalCount,
      winRate,
      profitFactor,
      totalProfit,
      totalLoss,
      avgWin,
      avgLoss,
      longCount,
      shortCount,
      longWinRate,
      shortWinRate,
      futuresRatio,
      troubleTags: TroubleTagsList,
      profitTags: ProfitTagsList
    };
  }, [trades]);

  const riskAdvice = useMemo(() => {
    const maxLossCash = riskBalance * (riskPercent / 100);
    const nominalPositionSize = stopLossGap > 0 ? maxLossCash / (stopLossGap / 100) : 0;
    const requiredMargin = riskLeverage > 0 ? nominalPositionSize / riskLeverage : 0;
    const overLeveraged = nominalPositionSize > riskBalance;

    return {
      maxLossCash,
      nominalPositionSize,
      requiredMargin,
      overLeveraged
    };
  }, [riskBalance, riskPercent, stopLossGap, riskLeverage]);

  return (
    <div className="min-h-screen bg-crypto-dark text-gray-200 selection:bg-crypto-accent/30 flex flex-col font-sans">
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
            placeholder="搜索记录或使用 #标签..."
            className="w-full bg-gray-900/50 border border-gray-800 rounded-full py-2 pl-12 pr-4 text-sm focus:outline-none focus:border-crypto-accent transition-all text-gray-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={16}/></button>}
        </div>

        <div className="flex items-center gap-6">
           <div className="text-right hidden md:block">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">已实现总盈亏</p>
              <p className={`text-lg font-mono font-black ${totalHistoricalPnl >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                ${totalHistoricalPnl.toFixed(2)}
              </p>
           </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 items-start">
        
        {/* 左侧：计算器 */}
        <aside className="lg:col-span-3 space-y-6 order-2 lg:order-1">
          <div className="sticky top-24">
            <TradeCalculator onAddTrade={addTrade} availableCoins={availableCoins} apiError={apiError} />
            <div className="mt-6 p-4 bg-crypto-card/30 rounded-2xl border border-gray-800/50 text-center flex flex-col items-center justify-center gap-1">
               <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">Trading Log Assistant</p>
               <button onClick={fetchCoinList} disabled={isRefreshingCoins} className="text-[10px] text-crypto-accent hover:underline flex items-center gap-1 font-bold mt-1">
                 <RefreshCw size={10} className={isRefreshingCoins ? "animate-spin" : ""} />
                 {isRefreshingCoins ? '刷新中' : '手动刷新行情'}
               </button>
            </div>
          </div>
        </aside>

        {/* 中间：主记录/持仓区 */}
        <section className="lg:col-span-6 space-y-6 order-1 lg:order-2">
          <div className="flex items-center justify-between mb-2 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 p-1 bg-gray-900 w-fit rounded-xl border border-gray-800 shrink-0">
              <button onClick={() => setActiveTab('daily')} className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'daily' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><Activity size={14}/>当日复盘</button>
              <button onClick={() => setActiveTab('holdings')} className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'holdings' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><Database size={14}/>我的持仓 <span className="bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded-full text-[9px] font-black">{activeHoldings.length}</span></button>
              <button onClick={() => setActiveTab('timeline')} className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'timeline' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><List size={14}/>全部记录</button>
              <button onClick={() => setActiveTab('analytics')} className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'analytics' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><Percent size={14}/>量化诊断</button>
              <button onClick={() => setActiveTab('binance')} className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'binance' ? 'bg-gray-800 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><Link size={14}/>币安同步</button>
            </div>
          </div>

          {activeTab === 'daily' && (
            <div className="space-y-6">
              <div className="bg-crypto-card p-6 rounded-3xl border border-gray-800 shadow-2xl relative">
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                    <h2 className="text-xl font-bold text-white tracking-tight">{selectedDate} 复盘反思</h2>
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {(dailyNotes[selectedDate]?.tags || []).map(t => (
                      <button key={t} onClick={() => handleTagClick(t)} className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[10px] font-bold">#{t}</button>
                    ))}
                  </div>
                </div>
                <textarea 
                  className="w-full h-56 bg-gray-900/50 border border-gray-800 rounded-2xl p-5 text-sm focus:outline-none focus:border-crypto-accent resize-none mb-5 font-normal leading-relaxed text-gray-300"
                  placeholder="写下今日复盘感悟... (输入 #标签 自动归档)"
                  value={dailyNotes[selectedDate]?.summary || ''}
                  onChange={(e) => updateDailySummary(e.target.value)}
                />
                <div className="flex items-center justify-between border-t border-gray-800/50 pt-5">
                  <button onClick={generateMarkdownReport} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-black text-white transition-all shadow-lg active:scale-95">
                    {copySuccess ? <Check size={14}/> : <Share2 size={14}/>} {copySuccess ? 'MARKDOWN 已复制' : '复制复盘报告 (MD)'}
                  </button>
                  <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1"><Check size={12} className="text-crypto-up"/> 数据已实时存至本地</span>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] px-2 flex items-center gap-2"><TrendingUp size={12}/> 当日成交明细</h3>
                {filteredTrades.length === 0 ? (
                  <div className="text-center py-20 bg-crypto-card/10 rounded-3xl border-2 border-dashed border-gray-800 text-gray-600 text-sm">今日暂无流水记录</div>
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
                                <span className="bg-blue-500/10 text-crypto-accent border border-blue-500/30 text-[9px] font-black tracking-wider py-0.5 px-1.5 rounded uppercase">持仓中</span>
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
                           <button onClick={() => setTrades(trades.filter(t => t.id !== trade.id))} className="text-gray-700 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'holdings' && (
            <div className="space-y-6 animate-fadeIn">
              {/* 持仓卡片数据汇总板块 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 bg-gradient-to-br from-indigo-950/20 to-crypto-card rounded-2xl border border-gray-800/80">
                   <p className="text-[10px] text-gray-500 font-black uppercase tracking-wider mb-1">当前持仓本金</p>
                   <p className="text-xl font-mono font-black text-white">${holdingsStats.totalMargin?.toLocaleString(undefined, { minimumFractionDigits: 1 })} <span className="text-[10px] text-gray-600 font-sans">USDT</span></p>
                </div>
                <div className={`p-5 rounded-2xl border ${holdingsStats.totalFloatingPnL >= 0 ? 'bg-emerald-950/10 border-emerald-950/40' : 'bg-rose-950/10 border-rose-950/40'}`}>
                   <p className="text-[10px] text-gray-500 font-black uppercase tracking-wider mb-1">总浮动盈亏</p>
                   <p className={`text-xl font-mono font-black ${holdingsStats.totalFloatingPnL >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                     {holdingsStats.totalFloatingPnL >= 0 ? '+' : ''}${holdingsStats.totalFloatingPnL?.toFixed(2)}
                   </p>
                </div>
                <div className="p-5 bg-gradient-to-br from-crypto-card to-gray-950 rounded-2xl border border-gray-800/80">
                   <p className="text-[10px] text-gray-500 font-black uppercase tracking-wider mb-1">最高收益持仓</p>
                   <p className="text-base font-bold text-gray-300 truncate">{holdingsStats.bestSymbol}</p>
                </div>
              </div>

              {/* 止盈止损与持仓列表 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2"><Coins size={14}/> 活跃持仓管理与 AI 调仓建议</h3>
                  {apiError && <span className="text-[10px] text-amber-500 animate-pulse font-bold">⚠️ 网络行情连接限制，支持在卡片中自定义行情估值进行演算</span>}
                </div>

                {activeHoldings.length === 0 ? (
                  <div className="text-center py-20 bg-crypto-card/10 rounded-3xl border-2 border-dashed border-gray-800 text-gray-500 text-sm space-y-3">
                     <Database size={40} className="mx-auto mb-1 opacity-20" />
                     <p>您当前没有任何正在持有的仓位。</p>
                     <p className="text-xs text-gray-600">可以在左侧盈亏计算器中，在第二排切换为「当前持仓中」进行快捷追加持仓！</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {activeHoldings.map(trade => {
                      // 读取行情价
                      const marketCoin = availableCoins.find(c => c.symbol.toLowerCase() === trade.symbol.toLowerCase());
                      const customPrice = customPrices[trade.id];
                      const currentPrice = customPrice !== undefined ? customPrice : (marketCoin?.current_price || trade.entryPrice);

                      // 收益率重算
                      const entry = trade.entryPrice;
                      const lev = trade.type === 'SPOT' ? 1 : trade.leverage;
                      const size = trade.type === 'SPOT' ? trade.amount : trade.amount * lev;
                      const coinAmount = trade.quantity || (size / entry);
                      const pnl = trade.direction === 'LONG' ? (currentPrice - entry) * coinAmount : (entry - currentPrice) * coinAmount;
                      const roi = (trade.amount > 0) ? (pnl / trade.amount) * 100 : 0;

                      return (
                        <div key={trade.id} className="bg-crypto-card p-6 rounded-3xl border border-gray-800 shadow-xl space-y-5">
                          {/* 仓位头部 */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-800/40 pb-4 gap-4">
                            <div className="flex items-center gap-3">
                              <span className="text-xl font-black text-white tracking-tight">{trade.symbol}</span>
                              <span className={`text-[10px] px-2.5 py-0.5 rounded font-black tracking-wide ${trade.direction === 'LONG' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : 'bg-rose-950 text-rose-400 border border-rose-900/50'}`}>
                                {trade.direction === 'LONG' ? '买入看多 LONG' : '卖出看空 SHORT'}
                              </span>
                              <span className="text-[10px] bg-slate-900 text-slate-400 border border-slate-800 py-0.5 px-2 rounded-md font-bold">
                                {trade.type === 'FUTURES' ? `合约 ${trade.leverage}x` : '现货 SPOT'}
                              </span>
                            </div>

                            <div className="text-left sm:text-right">
                              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">当前持仓估算盈亏</div>
                              <div className="flex items-baseline gap-2">
                                <span className={`text-lg font-mono font-black ${pnl >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                                  {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                                </span>
                                <span className={`text-xs font-mono font-bold ${roi >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                                  ({roi >= 0 ? '+' : ''}{roi.toFixed(2)}%)
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 持仓明细 */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div className="p-3 bg-gray-900/40 rounded-xl border border-gray-800/50">
                              <span className="text-[10px] text-gray-500 block font-bold mb-1 uppercase">建仓均价 (Cost)</span>
                              <span className="font-mono text-white text-sm font-semibold">${trade.entryPrice}</span>
                            </div>
                            <div className="p-3 bg-gray-900/40 rounded-xl border border-gray-800/50">
                              <span className="text-[10px] text-gray-400 block font-bold mb-1 uppercase">持仓数量 (Quantity)</span>
                              <span className="font-mono text-white text-sm font-semibold">
                                {coinAmount % 1 === 0 ? coinAmount : coinAmount.toFixed(4)} <span className="text-[10px] text-gray-600 font-sans">{trade.symbol}</span>
                              </span>
                            </div>
                            <div className="p-3 bg-gray-900/40 rounded-xl border border-gray-800/50">
                              <span className="text-[10px] text-gray-500 block font-bold mb-1 uppercase">持仓本金 (Capital)</span>
                              <span className="font-mono text-white text-sm font-semibold">${trade.amount.toFixed(2)} <span className="text-[10px] text-gray-600">USDT</span></span>
                            </div>
                            <div className="p-3 bg-gray-900/40 rounded-xl border border-gray-800/50">
                              <span className="text-[10px] text-crypto-accent block font-bold mb-1 uppercase flex justify-between items-center">
                                <span>行情模拟价</span>
                                {customPrice !== undefined && (
                                  <button onClick={() => {
                                    setCustomPrices(prev => {
                                      const copy = { ...prev };
                                      delete copy[trade.id];
                                      return copy;
                                    });
                                  }} className="text-[9px] hover:underline text-gray-500 font-bold">重置</button>
                                )}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500 font-mono text-xs leading-none">$</span>
                                <input 
                                  type="number" 
                                  step="any"
                                  value={customPrice !== undefined ? customPrice : (currentPrice || '')}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setCustomPrices(prev => ({ ...prev, [trade.id]: isNaN(val) ? 0 : val }));
                                  }}
                                  className="bg-transparent text-white font-mono text-xs border-b border-gray-800 focus:border-crypto-accent outline-none w-full py-0 pb-1"
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 交易备注 */}
                          {trade.note && (
                            <div className="bg-gray-950/20 p-3.5 rounded-2xl border border-gray-800/50 text-xs">
                              <span className="text-gray-500 font-bold block mb-1 uppercase text-[10px]">建仓心得 / 逻辑依据 :</span>
                              <q className="text-gray-400 font-medium">“{trade.note}”</q>
                            </div>
                          )}

                          {/* 操纵按键区与AI顾问呼叫 */}
                          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-gray-800/30">
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => getAIAdvice(trade, currentPrice)}
                                disabled={loadingAdvisorId === trade.id}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl text-xs font-black text-white hover:shadow-lg hover:shadow-indigo-900/30 active:scale-95 transition-all disabled:opacity-50"
                              >
                                <Sparkles size={14} className={loadingAdvisorId === trade.id ? "animate-spin" : ""} />
                                {loadingAdvisorId === trade.id ? '分析中...' : 'AI 止盈止损决策建议'}
                              </button>

                              {settlingTradeId === trade.id ? (
                                <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl p-1 gap-2">
                                  <input 
                                    type="number"
                                    step="any"
                                    value={settlementPrice}
                                    onChange={(e) => setSettlementPrice(e.target.value)}
                                    className="w-24 bg-transparent border-0 font-mono text-xs text-white pl-2 focus:outline-none"
                                    placeholder="平仓价格"
                                    autoFocus
                                  />
                                  <button onClick={() => executeSettleTrade(trade.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] py-1.5 px-3 rounded-lg mr-1 transition-all">
                                    确认平仓结算
                                  </button>
                                  <button onClick={() => setSettlingTradeId(null)} className="text-gray-500 hover:text-white p-1 pr-2"><X size={14}/></button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => triggerSettleTrade(trade, currentPrice)}
                                  className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs text-gray-200 hover:text-white font-bold transition-all active:scale-95"
                                >
                                  平仓结案
                                </button>
                              )}
                            </div>

                            <button onClick={() => setTrades(trades.filter(t => t.id !== trade.id))} className="text-gray-600 hover:text-red-500 hover:bg-red-500/10 p-2.5 rounded-xl transition-all" title="删除持仓，不记录到复盘日记">
                              <Trash2 size={15} />
                            </button>
                          </div>

                          {/* AI 止盈止损方案渲染板 */}
                          {advisorAdvice[trade.id] && (
                            <div className="mt-4 p-5 bg-indigo-950/10 rounded-2xl border border-indigo-500/20 text-xs space-y-4 relative overflow-hidden animate-slideUp">
                               <div className="absolute top-0 right-0 py-1.5 px-3 bg-indigo-500/10 text-indigo-300 font-bold text-[9px] rounded-bl-xl flex items-center gap-1">
                                  <Sparkles size={8} className="animate-spin text-crypto-accent" /> AI 分析结果
                               </div>
                               <h4 className="font-bold text-indigo-400 text-sm flex items-center gap-2 mb-2">
                                 <Sparkles size={15} /> AI 止盈止损策略演算
                               </h4>
                               
                               <p className="text-gray-300 leading-relaxed italic bg-gray-950/20 p-3.5 rounded-2xl border border-gray-800/40">
                                 “ {advisorAdvice[trade.id].summary} ”
                               </p>

                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                  {/* TP Levels */}
                                  <div className="space-y-2.5">
                                     <div className="text-[10px] text-emerald-400 font-black uppercase tracking-wider flex items-center gap-1">🎯 目标止盈计划（分批退出 Take Profit）</div>
                                     <div className="space-y-1.5">
                                        <div className="p-3 bg-emerald-950/10 border border-emerald-900/30 rounded-2xl">
                                           <div className="flex justify-between items-center mb-0.5">
                                              <span className="font-black text-emerald-400 text-[11px]">第一目标价（保守 / 落袋）</span>
                                              <span className="font-mono text-white text-xs font-black">${advisorAdvice[trade.id].levels.conservativeTP.price} ({advisorAdvice[trade.id].levels.conservativeTP.percent}%)</span>
                                           </div>
                                           <p className="text-[10px] text-gray-400 font-normal leading-relaxed">{advisorAdvice[trade.id].levels.conservativeTP.reason}</p>
                                        </div>
                                        <div className="p-3 bg-emerald-950/10 border border-emerald-900/30 rounded-2xl">
                                           <div className="flex justify-between items-center mb-0.5">
                                              <span className="font-black text-emerald-400 text-[11px]">第二目标价（稳健 / 主力）</span>
                                              <span className="font-mono text-white text-xs font-black">${advisorAdvice[trade.id].levels.moderateTP.price} ({advisorAdvice[trade.id].levels.moderateTP.percent}%)</span>
                                           </div>
                                           <p className="text-[10px] text-gray-400 font-normal leading-relaxed">{advisorAdvice[trade.id].levels.moderateTP.reason}</p>
                                        </div>
                                        <div className="p-3 bg-emerald-950/10 border border-emerald-900/30 rounded-2xl">
                                           <div className="flex justify-between items-center mb-0.5">
                                              <span className="font-black text-emerald-400 text-[11px]">第三目标价（激进 / 突破）</span>
                                              <span className="font-mono text-white text-xs font-black">${advisorAdvice[trade.id].levels.aggressiveTP.price} ({advisorAdvice[trade.id].levels.aggressiveTP.percent}%)</span>
                                           </div>
                                           <p className="text-[10px] text-gray-400 font-normal leading-relaxed">{advisorAdvice[trade.id].levels.aggressiveTP.reason}</p>
                                        </div>
                                     </div>
                                  </div>

                                  {/* SL and Indicators */}
                                  <div className="space-y-2.5 flex flex-col justify-between">
                                     <div className="space-y-1.5">
                                        <div className="text-[10px] text-rose-400 font-black uppercase tracking-wider flex items-center gap-1">🛑 强制止损位防御（失效控制 Stop Loss）</div>
                                        <div className="p-3 bg-rose-950/10 border border-rose-900/30 rounded-2xl">
                                           <div className="flex justify-between items-center mb-0.5">
                                              <span className="font-black text-rose-400 text-[11px]">清仓平盘线</span>
                                              <span className="font-mono text-red-400 text-xs font-black">${advisorAdvice[trade.id].levels.stopLoss.price} ({advisorAdvice[trade.id].levels.stopLoss.percent}%)</span>
                                           </div>
                                           <p className="text-[10px] text-gray-400 font-normal leading-relaxed">{advisorAdvice[trade.id].levels.stopLoss.reason}</p>
                                        </div>
                                     </div>

                                     <div className="bg-gray-950/30 border border-gray-800/50 p-4 rounded-2xl space-y-2">
                                        <div className="flex justify-between items-center text-[10px] border-b border-gray-900 pb-1.5">
                                           <span className="text-gray-500 font-bold uppercase">理论盈亏比 Estimate Ratio</span>
                                           <span className="font-mono text-indigo-300 font-black text-xs">{advisorAdvice[trade.id].riskReward}</span>
                                        </div>
                                        <div className="space-y-1.5">
                                           <span className="text-[9px] text-gray-500 font-bold block uppercase">评估技术面分形指标</span>
                                           <div className="flex flex-wrap gap-1">
                                              {advisorAdvice[trade.id].technicalIndicators.map((ind, i) => (
                                                 <span key={i} className="text-[9px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-lg border border-indigo-500/20 font-bold">#{ind}</span>
                                              ))}
                                           </div>
                                        </div>
                                     </div>
                                  </div>
                               </div>

                               <div className="p-4 bg-gray-950/40 rounded-2xl border border-gray-800/60 space-y-1.5">
                                  <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider mb-1">💡 战术执行计划</p>
                                  <p className="text-xs text-gray-400 font-normal leading-relaxed text-justify">{advisorAdvice[trade.id].tacticalAdvice}</p>
                               </div>
                            </div>
                          )}

                          {advisorError && (
                            <div className="p-4 bg-rose-950/10 border border-rose-900/30 rounded-2xl text-xs text-rose-400 flex items-center gap-2">
                              <AlertTriangle size={14} className="shrink-0" />
                              <span>{advisorError}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {filteredNoteTimeline.length === 0 ? (
                <div className="h-80 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-800 rounded-[2.5rem] bg-crypto-card/10">
                   <MessageSquare size={48} className="mb-4 opacity-10"/>
                   <p className="text-sm font-bold uppercase tracking-widest">NO RECORDS FOUND</p>
                </div>
              ) : (
                filteredNoteTimeline.map(note => (
                  <div key={note.dateStr} onClick={() => { setSelectedDate(note.dateStr); setActiveTab('daily'); }} className="bg-crypto-card p-6 rounded-3xl border border-gray-800 hover:border-crypto-accent/40 transition-all cursor-pointer group shadow-sm animate-fadeIn">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-black text-white">{note.dateStr}</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {note.tags.map(t => (
                            <span key={t} className="text-[10px] bg-gray-900 text-gray-500 px-2 py-0.5 rounded-lg border border-gray-800 font-bold">#{t}</span>
                          ))}
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-gray-700 group-hover:text-crypto-accent transition-all"/>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">{note.summary}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Quant Metrics Header Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="p-5 bg-crypto-card rounded-2xl border border-gray-800 space-y-1">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">交易胜算 (Win Rate)</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-mono font-black text-white">{quantStats.winRate.toFixed(1)}%</span>
                    <span className="text-gray-500 font-sans font-medium">({quantStats.totalCount} 战)</span>
                  </div>
                  <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden mt-2">
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${quantStats.winRate}%` }}></div>
                  </div>
                </div>

                <div className="p-5 bg-crypto-card rounded-2xl border border-gray-800 space-y-1">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">盈亏比系数 (Profit Factor)</p>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-mono font-black ${quantStats.profitFactor >= 1.5 ? 'text-crypto-up' : quantStats.profitFactor >= 1.0 ? 'text-indigo-400' : 'text-crypto-down'}`}>
                      {quantStats.profitFactor === 999 ? '∞' : quantStats.profitFactor.toFixed(2)}
                    </span>
                    <span className="text-gray-500 font-sans font-medium">系数</span>
                  </div>
                  <p className="text-[9px] text-gray-500 font-normal">多于 1.5 表示您拥有健康的正期望系统</p>
                </div>

                <div className="p-5 bg-crypto-card rounded-2xl border border-gray-800 space-y-1 border-emerald-950/20 bg-gradient-to-b from-crypto-card to-emerald-950/5">
                  <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1">平均单笔盈利</p>
                  <p className="text-xl font-mono font-black text-crypto-up">+${quantStats.avgWin.toFixed(1)}</p>
                  <p className="text-[9px] text-gray-500 font-normal">落袋为安，总计 {trades.filter(t => t.status === 'CLOSED' && t.pnl > 0).length} 笔成功</p>
                </div>

                <div className="p-5 bg-crypto-card rounded-2xl border border-gray-800 space-y-1 border-rose-950/20 bg-gradient-to-b from-crypto-card to-rose-950/5">
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mb-1">平均单笔亏损</p>
                  <p className="text-xl font-mono font-black text-crypto-down">-${quantStats.avgLoss.toFixed(1)}</p>
                  <p className="text-[9px] text-gray-500 font-normal">注意合理设置单笔最大止盈止损</p>
                </div>
              </div>

              {/* Behavior Analysis section & Leak audits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. 心态误区与盈利习惯审计 */}
                <div className="bg-crypto-card p-6 rounded-3xl border border-gray-800 space-y-4">
                  <div className="flex items-center gap-2 border-b border-gray-800/50 pb-3">
                    <AlertTriangle size={16} className="text-crypto-accent animate-pulse" />
                    <h3 className="text-sm font-black text-white uppercase tracking-tight font-sans">交易心情与行为漏洞诊断</h3>
                  </div>

                  {quantStats.totalCount === 0 ? (
                    <div className="text-center py-10 space-y-2">
                      <p className="text-xs text-gray-600 italic">暂无平仓盈亏数据，在交易备注 Note 中添写 #标签 即可激活心态分析</p>
                      <p className="text-[10px] text-gray-700">例如：#高位追高 #坚守规则 #情绪失控 等</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Success block */}
                      <div className="space-y-2">
                        <p className="text-[10px] text-emerald-400 font-black uppercase tracking-wider flex items-center gap-1">🟢 成功盈利模式 (需要继续发扬):</p>
                        {quantStats.profitTags.length === 0 ? (
                          <div className="p-3 bg-gray-950/10 border border-gray-901 rounded-xl text-[11px] text-gray-500 italic">尚未在盈利交易的心得备注中监测到心态标签</div>
                        ) : (
                          <div className="grid grid-cols-1 gap-2">
                            {quantStats.profitTags.slice(0, 3).map(item => (
                              <div key={item.tag} className="p-3 bg-emerald-950/10 border border-emerald-900/10 rounded-xl flex justify-between items-center text-xs">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-emerald-400">#{item.tag}</span>
                                  <span className="text-[9px] text-gray-500 block">出现 {item.count} 次 • 胜率 {item.winRate.toFixed(0)}%</span>
                                </div>
                                <span className="font-mono font-black text-crypto-up">获利总计 +${item.pnl.toFixed(1)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Trouble block */}
                      <div className="space-y-2">
                        <p className="text-[10px] text-rose-400 font-black uppercase tracking-wider flex items-center gap-1">⚠️ 亏损重灾区行为 (建议熔断强制隔离):</p>
                        {quantStats.troubleTags.length === 0 ? (
                          <div className="p-3 bg-gray-950/10 border border-gray-901 rounded-xl text-[11px] text-gray-500 italic">尚未在亏损交易的心得备注中监测到错误执念标签</div>
                        ) : (
                          <div className="grid grid-cols-1 gap-2">
                            {quantStats.troubleTags.slice(0, 3).map(item => (
                              <div key={item.tag} className="p-3 bg-rose-950/10 border border-rose-900/10 rounded-xl flex justify-between items-center text-xs">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-red-400">#{item.tag}</span>
                                  <span className="text-[9px] text-gray-500 block">出现 {item.count} 次 • 胜率 {item.winRate.toFixed(0)}%</span>
                                </div>
                                <span className="font-mono font-black text-crypto-down">亏损总计 -${Math.abs(item.pnl).toFixed(1)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <p className="text-[9.5px] text-gray-500 text-justify leading-relaxed border-t border-gray-900 pt-3">
                        💡 <strong>关联心得系统：</strong> 风控引擎会自动检索您关闭的历史成交「交易心得 note」里的 <code>#标签</code>。如果您在记账备注中填写如 <code>#情绪失控</code> 或 <code>#逆势抄底</code>，此处即刻展示行为审计。
                      </p>
                    </div>
                  )}
                </div>

                {/* 2. 经典多空与操作行为偏差 */}
                <div className="bg-crypto-card p-6 rounded-3xl border border-gray-800 space-y-4">
                  <div className="flex items-center gap-2 border-b border-gray-800/50 pb-3">
                    <Activity size={16} className="text-crypto-accent" />
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">多空胜算统计与行为倾向比对</h3>
                  </div>

                  <div className="space-y-5 text-xs">
                    {/* Long vs Short stats */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-bold block">看多 Long 方向战意</span>
                        <span className="font-mono text-white font-bold">{quantStats.longCount} 次建仓 • 胜率 {quantStats.longWinRate.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${quantStats.longWinRate}%` }}></div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-bold block">看空 Short 反向战意</span>
                        <span className="font-mono text-white font-bold">{quantStats.shortCount} 次建仓 • 胜率 {quantStats.shortWinRate.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-rose-500 h-full rounded-full transition-all duration-300" style={{ width: `${quantStats.shortWinRate}%` }}></div>
                      </div>
                    </div>

                    {/* Leverage vs spot ratio */}
                    <div className="p-4 bg-gray-950/40 rounded-2xl border border-gray-900 flex justify-between items-center">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">合约杠杆 vs 现货持仓占比</span>
                        <p className="text-[11px] text-gray-400 font-normal">合约衍生品交易比重:</p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-mono font-black text-indigo-400">{quantStats.futuresRatio.toFixed(0)}%</span>
                        <p className="text-[9px] text-gray-600 font-normal">{quantStats.futuresRatio > 70 ? '⚠️ 杠杆占比极高，注意减仓保本' : '🟢 避坑配置配平在良性比例'}</p>
                      </div>
                    </div>

                    <p className="text-[10px] text-gray-500 leading-relaxed bg-gray-950/10 p-3 rounded-2xl border border-gray-900/50">
                      🔬 <strong>多空阻击纠偏：</strong> 许多交易者深受「看多执念」所害，或者过度使用不合理的杠杆赌博。结合您的实操记录做出审视可以帮助建立优秀的职业操盘纪律。
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. 本金止损风控推荐工具 */}
              <div className="p-6 bg-gradient-to-br from-indigo-950/20 to-crypto-card rounded-3xl border border-indigo-500/20 space-y-5">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-gray-800/40 pb-4 gap-4">
                  <div className="flex items-center gap-3">
                     <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 rounded-xl">
                       <CheckCircle size={18} />
                     </div>
                     <div>
                       <h3 className="font-black text-white text-base tracking-tight">头寸控制防御与开仓仓位风控助手</h3>
                       <p className="text-[10px] text-gray-500 font-normal">基于经典仓位公式，在严格的最大承受亏损下，反推可以安全投入的头寸本金上限</p>
                     </div>
                  </div>
                  <span className="bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 text-[9px] font-black tracking-wider py-1 px-2.5 rounded uppercase self-start sm:self-auto">安全防御 1.0</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  <div className="space-y-1.5 text-xs">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">储备本金总池 (Account Balance)</label>
                    <input 
                      type="number"
                      value={riskBalance || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setRiskBalance(isNaN(val) ? 0 : val);
                      }}
                      className="w-full bg-gray-900 border border-gray-850 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                      placeholder="总储备金"
                    />
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <span>单笔最大安全风险系数</span>
                      <span className="text-crypto-accent font-mono font-black">{riskPercent}%</span>
                    </div>
                    <input 
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={riskPercent}
                      onChange={(e) => {
                        setRiskPercent(parseFloat(e.target.value));
                      }}
                      className="w-full h-1.5 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2.5"
                    />
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <span>本单设计止损宽幅</span>
                      <span className="text-indigo-400 font-mono font-black">{stopLossGap}%</span>
                    </div>
                    <input 
                      type="range"
                      min="1"
                      max="20"
                      step="1"
                      value={stopLossGap}
                      onChange={(e) => {
                        setStopLossGap(parseInt(e.target.value));
                      }}
                      className="w-full h-1.5 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-2.5"
                    />
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <span>演算合约杠杆</span>
                      <span className="text-purple-400 font-mono font-black">{riskLeverage}X</span>
                    </div>
                    <input 
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={riskLeverage}
                      onChange={(e) => {
                        setRiskLeverage(parseInt(e.target.value));
                      }}
                      className="w-full h-1.5 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-purple-500 mt-2.5"
                    />
                  </div>
                </div>

                <div className="p-5 bg-gray-950/60 rounded-2xl border border-gray-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="space-y-1.5 max-w-xl text-xs">
                    <span className="text-[10px] text-indigo-400 font-black uppercase tracking-wider flex items-center gap-1">📋 仓位量化建议计算单</span>
                    <p className="text-gray-300 font-normal leading-relaxed text-justify">
                      如果您在该特定仓位上触发布止损点 <strong className="text-indigo-300">（止损差距为 {stopLossGap}%）</strong>，您的最大单单实际本金损耗会被封顶在账户储备金的 <strong className="text-red-400">{riskPercent}%</strong> （即只发生 <strong className="font-mono text-white font-bold">${riskAdvice.maxLossCash.toFixed(1)} USDT</strong> 的折损）。
                    </p>
                    <p className="text-gray-400 leading-relaxed font-normal">
                      因此，在不击穿防线的前提下，您该单能安全开启得最大<strong>名义仓位 (Nominal Volume) 为 ${riskAdvice.nominalPositionSize.toFixed(0)} USDT</strong>。
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 shrink-0 w-full md:w-auto border-t md:border-t-0 md:border-l border-gray-800 pt-4 md:pt-0 md:pl-5 font-mono">
                    <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800/40 text-center">
                       <span className="text-[9px] text-gray-500 block uppercase font-bold mb-1">建议仓位本金 (USDT)</span>
                       <span className="text-sm font-black text-white">${riskAdvice.requiredMargin.toFixed(1)}</span>
                    </div>
                    <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800/40 text-center">
                       <span className="text-[9px] text-gray-500 block uppercase font-bold mb-1">建议合理买入市值</span>
                       <span className="text-sm font-black text-crypto-accent">${riskAdvice.nominalPositionSize.toFixed(0)}</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {activeTab === 'binance' && (
            <div className="space-y-6 animate-fadeIn">
              {/* API 绑定配置卡片 */}
              <div className="bg-crypto-card p-6 rounded-3xl border border-gray-800 shadow-2xl relative">
                <div className="flex items-center gap-3 mb-5 border-b border-gray-800/50 pb-3">
                  <div className="w-1.5 h-6 bg-purple-500 rounded-full"></div>
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-1.5">
                    <Key className="text-purple-400" size={20} /> 币安 API 密钥绑接与同步
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* API Key 填报 */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1.5">Binance API Key</label>
                      <input 
                        type="password"
                        placeholder="请输入您的币安 API Key"
                        value={binanceApiKey}
                        onChange={(e) => setBinanceApiKey(e.target.value)}
                        className="w-full bg-gray-900/60 border border-gray-800 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-purple-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1.5">Binance Secret Key</label>
                      <input 
                        type="password"
                        placeholder="请输入您的币安 Secret Key"
                        value={binanceSecretKey}
                        onChange={(e) => setBinanceSecretKey(e.target.value)}
                        className="w-full bg-gray-900/60 border border-gray-800 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-purple-500 font-mono"
                      />
                    </div>
                    <div className="p-3 bg-purple-950/10 border border-purple-900/20 rounded-xl text-[10px] text-purple-300 leading-relaxed font-sans flex items-start gap-2">
                      <CheckCircle size={14} className="shrink-0 mt-0.5 text-purple-400" />
                      <span>
                        <strong>🔒 本地隐私隔离防护：</strong> 您的 API Keys 唯独只会存储在您本人的本地浏览器 (LocalStorage) 内，每次同步均直接通过本地全栈 API 路由转发并动态生成 SHA256 签名，<strong>服务器绝不会搜集或存储您的账户明密匙</strong>。
                      </span>
                    </div>
                  </div>

                  {/* 同步筛选与触发 */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1.5">交易产品类别</label>
                        <div className="grid grid-cols-2 bg-gray-900 rounded-xl border border-gray-800 p-0.5">
                          <button 
                            type="button"
                            onClick={() => setBinanceType('SPOT')}
                            className={`py-1.5 px-2 text-[10px] font-black rounded-lg transition-all ${binanceType === 'SPOT' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-400'}`}
                          >
                            现货 SPOT
                          </button>
                          <button 
                            type="button"
                            onClick={() => setBinanceType('FUTURES')}
                            className={`py-1.5 px-2 text-[10px] font-black rounded-lg transition-all ${binanceType === 'FUTURES' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-400'}`}
                          >
                            合约 FUTURES
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1.5">交易币对 (Symbol)</label>
                        <input 
                          type="text"
                          placeholder="例如: BTCUSDT"
                          value={binanceSymbol}
                          onChange={(e) => setBinanceSymbol(e.target.value.toUpperCase().trim())}
                          className="w-full bg-gray-900/60 border border-gray-800 text-white rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-purple-500 font-mono text-center font-bold"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-rose-950/10 border border-rose-900/20 rounded-xl text-[10px] text-rose-400 leading-relaxed font-sans flex items-start gap-2">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5 text-rose-400" />
                      <span>
                        <strong>⚠️ 币安安全使用指南：</strong>
                        在币安后台生成 API Key 时，<strong>请千万只勾选【读取属性/只读】</strong>，千万不要勾选【允许交易】或【允许提币】。仅只读权限即可安全拉取成成交日记流水！
                      </span>
                    </div>

                    <button 
                      onClick={fetchBinanceTrades}
                      disabled={isBinanceSyncing}
                      className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800/40 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer"
                    >
                      <RefreshCw size={14} className={isBinanceSyncing ? "animate-spin" : ""} />
                      {isBinanceSyncing ? "正在安全通讯通讯并拉取中..." : "一键安全拉取币安成交流水"}
                    </button>
                  </div>
                </div>

                {/* 错误或成功提示 */}
                {binanceError && (
                  <div className="mt-4 p-4 bg-rose-950/15 border border-rose-900/40 rounded-2xl text-xs text-rose-400 flex items-center gap-2 font-medium">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{binanceError}</span>
                  </div>
                )}
                {binanceSuccessMsg && (
                  <div className="mt-4 p-4 bg-emerald-950/15 border border-emerald-900/40 rounded-2xl text-xs text-emerald-400 flex items-center gap-2 font-medium">
                    <CheckCircle size={14} className="shrink-0" />
                    <span>{binanceSuccessMsg}</span>
                  </div>
                )}
              </div>

              {/* 成交流水导入及日记撰写区 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <List size={12} /> 同步到的币安成交明细
                  </h3>
                  {binanceTrades.length > 0 && (
                    <span className="text-[10px] text-gray-400 font-mono font-bold">
                      当前共展示 {binanceTrades.length} 笔订单 fills
                    </span>
                  )}
                </div>

                {binanceTrades.length === 0 ? (
                  <div className="text-center py-20 bg-crypto-card/10 rounded-3xl border-2 border-dashed border-gray-800 text-gray-600 text-sm flex flex-col items-center justify-center gap-3">
                    <NotebookPen size={32} className="opacity-20 text-purple-400" />
                    <div className="space-y-1">
                      <p className="font-bold text-gray-500">暂无待导入的流水记录</p>
                      <p className="text-[11px] text-gray-600">在上方配置并配对 API 账户密钥后，点击“一键拉取”即可读取</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {binanceTrades.map((bTrade, idx) => {
                      const tradeId = String(bTrade.id);
                      const isImported = trades.some(t => t.id === `binance-${tradeId}`);
                      
                      // Identify specs
                      const isSpot = binanceType === 'SPOT';
                      const isBuyer = isSpot ? bTrade.isBuyer : (bTrade.side === 'BUY');
                      const sideLabel = isBuyer ? '买入建仓 (BUY)' : '卖出平仓 (SELL)';
                      
                      const priceVal = parseFloat(bTrade.price) || 0;
                      const qtyVal = parseFloat(bTrade.qty) || 0;
                      const totalNominal = isSpot ? (parseFloat(bTrade.quoteQty) || (priceVal * qtyVal)) : (priceVal * qtyVal);
                      
                      const formattedTime = new Date(bTrade.time).toLocaleString();
                      const statusVal = binanceTradeStatus[tradeId] || 'CLOSED';

                      return (
                        <div key={bTrade.id || idx} className={`p-5 rounded-2xl border transition-all ${isImported ? 'bg-gray-900/30 border-gray-800 opacity-70' : 'bg-crypto-card border-gray-800 hover:border-purple-900/30 shadow-lg'}`}>
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800/40 pb-3 mb-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2.5">
                                <span className="font-black text-white text-base tracking-tight">{bTrade.symbol}</span>
                                <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${isBuyer ? 'bg-emerald-950/65 text-emerald-400 border border-emerald-900/20' : 'bg-rose-950/65 text-rose-400 border border-rose-900/20'}`}>
                                  {sideLabel}
                                </span>
                                <span className="text-[9px] text-gray-500 font-semibold">{binanceType}</span>
                              </div>
                              <p className="text-[10px] text-gray-500 font-mono font-medium">
                                交易时间: {formattedTime} | 币安流水 ID: {bTrade.id}
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Ledger Mode select */}
                              <div className="flex bg-gray-950 rounded-lg p-0.5 border border-gray-800 select-none">
                                <button
                                  type="button"
                                  disabled={isImported}
                                  onClick={() => setBinanceTradeStatus(prev => ({ ...prev, [tradeId]: 'CLOSED' }))}
                                  className={`px-2 py-1 text-[9px] font-bold rounded transiton-all ${statusVal === 'CLOSED' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-400'}`}
                                >
                                  已结清平仓
                                </button>
                                <button
                                  type="button"
                                  disabled={isImported}
                                  onClick={() => setBinanceTradeStatus(prev => ({ ...prev, [tradeId]: 'HOLDING' }))}
                                  className={`px-2 py-1 text-[9px] font-bold rounded transiton-all ${statusVal === 'HOLDING' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-400'}`}
                                >
                                  设为持仓中
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Data info grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono mb-4">
                            <div className="p-2.5 bg-gray-900/40 rounded-xl border border-gray-800/30">
                              <span className="text-[9px] text-gray-500 block uppercase font-bold mb-0.5">成交价格</span>
                              <span className="text-white font-bold">${priceVal.toLocaleString()}</span>
                            </div>
                            <div className="p-2.5 bg-gray-900/40 rounded-xl border border-gray-800/30">
                              <span className="text-[9px] text-gray-500 block uppercase font-bold mb-0.5">成交数量</span>
                              <span className="text-white font-bold">{qtyVal} <span className="text-[9px] text-gray-600 font-sans">{bTrade.symbol.replace("USDT", "")}</span></span>
                            </div>
                            <div className="p-2.5 bg-gray-900/40 rounded-xl border border-gray-800/30">
                              <span className="text-[9px] text-gray-500 block uppercase font-bold mb-0.5">成交额 (Nominal)</span>
                              <span className="text-white font-bold">${totalNominal.toFixed(2)} USDT</span>
                            </div>
                            <div className="p-2.5 bg-gray-900/40 rounded-xl border border-gray-800/30">
                              <span className="text-[9px] text-gray-600 block uppercase font-bold mb-0.5">实现盈亏 Realized PnL</span>
                              {!isSpot && parseFloat(bTrade.realizedPnl || '0') !== 0 ? (
                                <span className={`font-bold ${parseFloat(bTrade.realizedPnl) >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
                                  {parseFloat(bTrade.realizedPnl) >= 0 ? '+' : ''}{parseFloat(bTrade.realizedPnl).toFixed(2)} USDT
                                </span>
                              ) : (
                                <span className="text-gray-500 font-sans">-- (现货或一阶流动仓)</span>
                              )}
                            </div>
                          </div>

                          {/* Note taking input and Save CTA */}
                          <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3 pt-3 border-t border-gray-800/20">
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-500 font-bold block mb-1 uppercase">撰写本成交复盘日记（可添加 #失控 #纪律 标签自动统计）</label>
                              <input 
                                type="text"
                                disabled={isImported}
                                placeholder={isImported ? "该笔成交已归档导入" : "写下这笔交易背后的博弈故事与心得，点击右侧导入系统..."}
                                value={binanceTradeNotes[tradeId] || ''}
                                onChange={(e) => setBinanceTradeNotes(prev => ({ ...prev, [tradeId]: e.target.value }))}
                                className="w-full bg-gray-900/40 border border-gray-800 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-purple-500/85"
                              />
                            </div>
                            <button 
                              type="button"
                              onClick={() => importBinanceTrade(bTrade)}
                              disabled={isImported}
                              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all w-full md:w-auto cursor-pointer ${isImported ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white active:scale-95 shadow-md'}`}
                            >
                              {isImported ? (
                                <>
                                  <Check size={14} /> 已录入复盘笔记
                                </>
                              ) : (
                                <>
                                  <NotebookPen size={14} /> 确认并录入笔记
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 右侧列：日历(顶) -> 标签(中) -> 存档(底) */}
        <aside className="lg:col-span-3 space-y-6 order-3">
          
          {/* 1. 日历 (置顶) */}
          <div className="bg-crypto-card rounded-3xl border border-gray-800 p-5 shadow-xl">
            <Calendar 
              trades={trades} 
              dailyNotes={dailyNotes} 
              selectedDate={selectedDate} 
              onSelectDate={(d) => { setSelectedDate(d); setActiveTab('daily'); }} 
            />
          </div>

          {/* 2. 热搜标签 (中间) */}
          <div className="bg-crypto-card rounded-3xl border border-gray-800 p-6 shadow-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
               <Tag size={64}/>
             </div>
             <div className="flex items-center gap-2 mb-5 text-gray-400 font-black text-[10px] uppercase tracking-[0.2em]">
                <Tag size={16} className="text-crypto-accent" />
                热搜标签库
             </div>
             <div className="flex flex-wrap gap-2">
                {commonTags.length > 0 ? commonTags.map(([tag, count]) => (
                  <button key={tag} onClick={() => handleTagClick(tag)} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 ${searchQuery === `#${tag}` ? 'bg-crypto-accent text-crypto-dark shadow-lg' : 'bg-gray-900/50 text-gray-400 hover:text-white border border-gray-800'}`}>
                    <Hash size={10} /> {tag} <span className="opacity-40 text-[9px] font-mono">{count}</span>
                  </button>
                )) : (
                  <span className="text-xs text-gray-600 italic py-4 w-full text-center">尚未记录标签</span>
                )}
             </div>
          </div>

          {/* 3. 数据存档管理 (底部) */}
          <div className="bg-gradient-to-br from-crypto-card to-gray-950 rounded-3xl border border-gray-700/60 p-6 shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
               <Database size={64}/>
             </div>
             <div className="flex items-center gap-2 mb-5 text-white font-black text-xs uppercase tracking-[0.2em]">
                <Database size={16} className="text-crypto-accent" />
                数据管家
             </div>
             <div className="flex flex-col gap-3">
                <button onClick={handleExportData} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800/80 border border-gray-700 hover:border-crypto-accent/50 rounded-2xl text-xs font-bold text-white hover:bg-gray-800 transition-all active:scale-95">
                  <Download size={14} /> 备份数据 JSON
                </button>
                <div className="relative">
                  <input type="file" accept=".json" onChange={handleImportData} ref={fileInputRef} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800/80 border border-gray-700 hover:border-crypto-accent/50 rounded-2xl text-xs font-bold text-white hover:bg-gray-800 transition-all">
                    <Upload size={14} /> 恢复备份文件
                  </button>
                </div>
             </div>
             <p className="mt-4 text-[9px] text-gray-600 font-bold uppercase text-center tracking-widest">Storage v1.3</p>
          </div>

        </aside>

      </main>

      <footer className="py-8 border-t border-gray-800/50 text-center">
        <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.5em] opacity-40">
          CRYPTO LOG • FOCUS • ANALYZE • EVOLVE
        </p>
      </footer>
    </div>
  );
};

export default App;
