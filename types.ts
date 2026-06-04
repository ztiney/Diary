
export type TradeType = 'SPOT' | 'FUTURES';
export type PositionDirection = 'LONG' | 'SHORT';
export type TradeStatus = 'CLOSED' | 'HOLDING';

export interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price: number;
  price_change_percentage_24h: number;
}

export interface TradeRecord {
  id: string;
  coinId?: string;
  symbol: string;
  type: TradeType;
  direction: PositionDirection;
  status: TradeStatus;
  entryPrice: number;
  exitPrice: number;
  amount: number;
  leverage: number; 
  pnl: number;
  roi: number;
  note: string;
  timestamp: number;
  dateStr: string; // 关联日期的 Key (YYYY-MM-DD)
  quantity?: number; // 数量 (现货记录或合约张数)
}

export interface DailyNote {
  dateStr: string;
  summary: string;
  tags: string[];
}

export interface CalculatorState {
  symbol: string;
  coinId?: string;
  entryPrice: string;
  exitPrice: string;
  amount: string;
  leverage: string;
  direction: PositionDirection;
  type: TradeType;
  status: TradeStatus;
  note: string;
  quantity?: string; // 用户输入的现货数量
}
