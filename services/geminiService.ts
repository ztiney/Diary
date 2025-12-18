
import { GoogleGenAI } from "@google/genai";
import { TradeRecord, DailyNote } from "../types";

export const generateDailyAIReport = async (date: string, trades: TradeRecord[], note: DailyNote) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const tradesSummary = trades.map(t => 
    `- ${t.symbol} (${t.direction} ${t.type}): 进场 $${t.entryPrice}, 出场 $${t.exitPrice}, 盈亏 $${t.pnl.toFixed(2)} (${t.roi.toFixed(1)}%), 备注: ${t.note}`
  ).join('\n');

  const prompt = `
    你是一位专业的加密货币交易教练。请根据我 ${date} 的交易数据和心得，生成一份深度的复盘报告。
    
    【今日交易数据】:
    ${tradesSummary || '暂无交易记录'}
    
    【我的心得】:
    ${note.summary || '未填写心得'}
    
    【要求】:
    1. 分析我的盈利/亏损核心原因。
    2. 评价我的交易心态（根据心得中的描述）。
    3. 给出 3 条针对性的改进建议。
    4. 使用专业的交易术语，格式为 Markdown。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("AI Report Error:", error);
    return "AI 报告生成失败，请检查网络或 API Key。";
  }
};
