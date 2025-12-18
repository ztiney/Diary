
import React from 'react';
import { TradeRecord, DailyNote } from '../types';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';

interface CalendarProps {
  trades: TradeRecord[];
  dailyNotes: Record<string, DailyNote>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const Calendar: React.FC<CalendarProps> = ({ trades, dailyNotes, selectedDate, onSelectDate }) => {
  const today = new Date();
  const [viewDate, setViewDate] = React.useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const daysInMonth = getDaysInMonth(viewDate);
  const firstDay = getFirstDayOfMonth(viewDate);

  // 计算每日 PnL
  const dailyPnL: Record<string, number> = {};
  trades.forEach(trade => {
    if (!dailyPnL[trade.dateStr]) dailyPnL[trade.dateStr] = 0;
    dailyPnL[trade.dateStr] += trade.pnl;
  });

  const changeMonth = (offset: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-14 bg-gray-900/30 border border-gray-800/50"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateCheck = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
      const ds = dateCheck.toISOString().split('T')[0];
      const pnl = dailyPnL[ds];
      const hasNote = dailyNotes[ds]?.summary.trim().length > 0;
      const isSelected = selectedDate === ds;
      const isToday = today.toISOString().split('T')[0] === ds;

      days.push(
        <div 
          key={d} 
          onClick={() => onSelectDate(ds)}
          className={`h-14 border border-gray-800 p-1 flex flex-col justify-between cursor-pointer transition-all hover:bg-gray-800 relative
            ${isSelected ? 'bg-crypto-accent/20 ring-1 ring-inset ring-crypto-accent' : 'bg-gray-900'}
            ${isToday && !isSelected ? 'border-blue-500/50' : ''}
          `}
        >
          <div className="flex justify-between items-start">
            <span className={`text-[10px] font-mono ${isToday ? 'text-blue-400 font-bold' : 'text-gray-500'}`}>{d}</span>
            {hasNote && <MessageSquare size={8} className="text-crypto-accent fill-crypto-accent/20" />}
          </div>
          {pnl !== undefined && (
            <div className={`text-[9px] font-bold text-center truncate ${pnl >= 0 ? 'text-crypto-up' : 'text-crypto-down'}`}>
              {pnl > 0 ? '+' : ''}{Math.round(pnl)}
            </div>
          )}
        </div>
      );
    }
    return days;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 text-white px-1">
        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-700 rounded text-gray-400">
          <ChevronLeft size={16} />
        </button>
        <span className="font-bold text-xs uppercase tracking-widest">
          {viewDate.getFullYear()} . {viewDate.getMonth() + 1}
        </span>
        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-700 rounded text-gray-400">
          <ChevronRight size={16} />
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-px text-center mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
          <div key={day} className="text-[10px] text-gray-600 font-bold py-1">{day}</div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden border border-gray-800 bg-gray-800 shadow-inner">
        {renderDays()}
      </div>
    </div>
  );
};

export default Calendar;
