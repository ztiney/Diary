import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import crypto from "crypto";

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Google Gen AI lazily
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required but was not found.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// AI Take Profit and Stop Loss Advisor Endpoint
app.post("/api/gemini/advisor", async (req, res) => {
  const { symbol, type, direction, entryPrice, currentPrice, amount, leverage, note } = req.body;

  if (!symbol || !entryPrice) {
    return res.status(400).json({ error: "Missing required parameters: symbol and entryPrice are required." });
  }

  const prompt = `
你是一位专业的加密货币资深交易员、首席量化分析师。请针对用户的以下持仓，提供专业的止盈（Take Profit, TP）与止损（Stop Loss, SL）投资建议：

持仓基本信息：
- 币种名称: ${symbol.toUpperCase()}
- 交易类型: ${type} (现货 SPOT 或 合约 FUTURES)
- 交易方向: ${direction} (看多 LONG 或 看空 SHORT)
- 买入/开仓成本价: $${entryPrice}
- 当前市场价: $${currentPrice || entryPrice}
- 投入本金: $${amount} USDT
${type === 'FUTURES' ? ` - 合约杠杆: ${leverage}x` : ''}
${note ? `- 用户备注/交易心得: "${note}"` : ''}

请基于主流资产（如 BTC, ETH, SOL）或山寨币的分形结构、日内阻力支撑位和合理的数学盈亏比，给出止盈止损计划。
注意：如果是 FUTURES-SHORT 或是 SPOT-SHORT（如果可以做空），方向是看空（跌了赚钱），其止盈点应该【低于】买入价，止损点应该【高于】买入价；如果是 LONG（看多），止盈点应该【高于】买入价，止损点应该【低于】买入价。如果是普通的SPOT买入，方向默认是看多（LONG）。

请务必返回 JSON 结构体，其 Schema 应满足：
{
  "summary": "简明扼要的持仓现状与逻辑诊断，指出这一单的优劣势",
  "levels": {
    "conservativeTP": { "price": 0.0, "percent": 0.0, "reason": "保守止盈目标原因，例如：前期阻力位，落袋为安" },
    "moderateTP": { "price": 0.0, "percent": 0.0, "reason": "中度/移动止盈目标原因" },
    "aggressiveTP": { "price": 0.0, "percent": 0.0, "reason": "激进止盈/突破目标原因" },
    "stopLoss": { "price": 0.0, "percent": 0.0, "reason": "科学止损位设定理由，如：跌破强支撑位，避免更大损失" }
  },
  "riskReward": "盈亏比评估，如 1:2.5 或 1:3",
  "technicalIndicators": ["指标1，如 EMA20 处于上方", "指标2，如 RSI 超卖", "指标3"],
  "tacticalAdvice": "战术执行策略，例如：建议如何分批止盈，若行情发生变异，如何调低或调高止损保护动作。"
}
`;

  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["summary", "levels", "riskReward", "technicalIndicators", "tacticalAdvice"],
          properties: {
            summary: { type: Type.STRING },
            levels: {
              type: Type.OBJECT,
              required: ["conservativeTP", "moderateTP", "aggressiveTP", "stopLoss"],
              properties: {
                conservativeTP: {
                  type: Type.OBJECT,
                  required: ["price", "percent", "reason"],
                  properties: {
                    price: { type: Type.NUMBER },
                    percent: { type: Type.NUMBER },
                    reason: { type: Type.STRING }
                  }
                },
                moderateTP: {
                  type: Type.OBJECT,
                  required: ["price", "percent", "reason"],
                  properties: {
                    price: { type: Type.NUMBER },
                    percent: { type: Type.NUMBER },
                    reason: { type: Type.STRING }
                  }
                },
                aggressiveTP: {
                  type: Type.OBJECT,
                  required: ["price", "percent", "reason"],
                  properties: {
                    price: { type: Type.NUMBER },
                    percent: { type: Type.NUMBER },
                    reason: { type: Type.STRING }
                  }
                },
                stopLoss: {
                  type: Type.OBJECT,
                  required: ["price", "percent", "reason"],
                  properties: {
                    price: { type: Type.NUMBER },
                    percent: { type: Type.NUMBER },
                    reason: { type: Type.STRING }
                  }
                }
              }
            },
            riskReward: { type: Type.STRING },
            technicalIndicators: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            tacticalAdvice: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text || "{}";
    const data = JSON.parse(text);
    res.json(data);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "Failed to get advice from AI Advisor: " + (error.message || error) });
  }
});

// Binance Signed API Proxy Endpoint
app.post("/api/binance/trades", async (req, res) => {
  const { apiKey, secretKey, type, symbol } = req.body;

  if (!apiKey || !secretKey) {
    res.status(200).json({ error: "Binance API Key and Secret Key are required.", isError: true });
    return;
  }

  const activeSymbol = (symbol || "BTCUSDT").toUpperCase().trim();
  const timestamp = Date.now();
  const recvWindow = 5000;

  // Construct query string for signed Binance endpoints
  const queryString = `symbol=${activeSymbol}&timestamp=${timestamp}&recvWindow=${recvWindow}`;

  try {
    const signature = crypto
      .createHmac("sha256", secretKey.trim())
      .update(queryString)
      .digest("hex");

    const targetUrl = type === "FUTURES"
      ? `https://fapi.binance.com/fapi/v1/userTrades?${queryString}&signature=${signature}`
      : `https://api.binance.com/api/v3/myTrades?${queryString}&signature=${signature}`;

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": apiKey.trim(),
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      let errJson;
      try {
        errJson = JSON.parse(errText);
      } catch (e) {}
      const errMsg = errJson?.msg || errText || `HTTP response code ${response.status}`;
      res.status(200).json({ error: `Binance: ${errMsg}`, isError: true });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error("Binance Proxy Server Error:", error);
    res.status(200).json({ error: `Failed to fetch from Binance: ${error.message}`, isError: true });
  }
});

// Vite server integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
