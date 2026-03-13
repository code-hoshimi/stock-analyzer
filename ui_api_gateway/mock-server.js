"use strict";

/**
 * Unified server: serves the built frontend (./dist) and the APIv1 mock.
 * Run:  node mock-server.js
 * Default port: 6330
 */

const express = require("express");
const path = require("path");
const crypto = require("crypto");

const PORT = parseInt(process.env.PORT || "6330", 10);
const DIST_DIR = path.join(__dirname, "dist");

// ---- Mock data ----------------------------------------------------------------

const STOCK_PREVIEWS = [
  { symbol: "0700.HK", shortName: "Tencent Holdings Ltd.", exchange: "HKG", sector: "Technology", industry: "Internet Content & Information", close: 385.20, eodVolume: 18_432_100, currency: "HKD" },
  { symbol: "9988.HK", shortName: "Alibaba Group Holding Ltd.", exchange: "HKG", sector: "Consumer Cyclical", industry: "Internet Retail", close: 78.45, eodVolume: 32_891_000, currency: "HKD" },
  { symbol: "3690.HK", shortName: "Meituan", exchange: "HKG", sector: "Consumer Cyclical", industry: "Internet Retail", close: 138.60, eodVolume: 14_220_500, currency: "HKD" },
  { symbol: "1810.HK", shortName: "Xiaomi Corporation", exchange: "HKG", sector: "Technology", industry: "Consumer Electronics", close: 22.10, eodVolume: 87_654_200, currency: "HKD" },
  { symbol: "9618.HK", shortName: "JD.com Inc.", exchange: "HKG", sector: "Consumer Cyclical", industry: "Internet Retail", close: 112.30, eodVolume: 9_873_000, currency: "HKD" },
  { symbol: "0241.HK", shortName: "Alibaba Health Information Technology Ltd.", exchange: "HKG", sector: "Healthcare", industry: "Drug Manufacturers", close: 3.25, eodVolume: 42_100_000, currency: "HKD" },
  { symbol: "0992.HK", shortName: "Lenovo Group Ltd.", exchange: "HKG", sector: "Technology", industry: "Computer Hardware", close: 9.86, eodVolume: 55_320_100, currency: "HKD" },
  { symbol: "2382.HK", shortName: "Sunny Optical Technology", exchange: "HKG", sector: "Technology", industry: "Electronic Components", close: 62.35, eodVolume: 6_432_100, currency: "HKD" },
  { symbol: "2473.HK", shortName: "Pharmaron Beijing Co., Ltd.", exchange: "HKG", sector: "Healthcare", industry: "Biotechnology", close: 12.94, eodVolume: 5_218_700, currency: "HKD" },
  { symbol: "6690.HK", shortName: "Haier Smart Home Co., Ltd.", exchange: "HKG", sector: "Consumer Cyclical", industry: "Appliances", close: 22.80, eodVolume: 11_045_000, currency: "HKD" },
  { symbol: "9999.HK", shortName: "NetEase Inc.", exchange: "HKG", sector: "Technology", industry: "Electronic Gaming & Multimedia", close: 141.60, eodVolume: 4_912_300, currency: "HKD" },
];

/** Generate a plausible golden-cross signal for a symbol/pair */
function makeCrossSignals(symbol, maShort, maLong) {
  const baseClose = (STOCK_PREVIEWS.find((s) => s.symbol === symbol)?.close ?? 50) + (Math.random() - 0.5) * 5;
  const signals = [];

  // 1-3 synthetic signals
  const count = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const daysAgo = 30 + i * 45 + Math.floor(Math.random() * 20);
    const dt = new Date(Date.now() - daysAgo * 86_400_000);
    const isGolden = Math.random() > 0.4;
    const ma_s = baseClose * (0.97 + Math.random() * 0.04);
    const ma_l = baseClose * (0.95 + Math.random() * 0.04);
    const obv = Math.floor(100_000_000 + Math.random() * 200_000_000);
    const rsi = 30 + Math.random() * 50;
    const isObvRising = Math.random() > 0.4;
    const isBuy = isGolden && rsi < 70 && isObvRising;
    let note = "";
    if (!isBuy) {
      if (rsi >= 70) note += `RSI overbought(${rsi.toFixed(2)}) `;
      if (!isObvRising) note += "OBV not rising.";
    } else {
      note = "Golden cross confirmed with rising OBV.";
    }
    signals.push({
      datetime: dt.toISOString(),
      crossType: isGolden ? "GOLDEN_CROSS" : "DEATH_CROSS",
      maShort: parseFloat(ma_s.toFixed(4)),
      maLong: parseFloat(ma_l.toFixed(4)),
      close: parseFloat(baseClose.toFixed(4)),
      rsi: parseFloat(rsi.toFixed(4)),
      obv,
      isObvRising,
      isBuySignal: isBuy,
      note: note.trim(),
    });
  }
  return signals.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
}

// ---- App setup ----------------------------------------------------------------

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    return res.sendStatus(204);
  }
  next();
});

// ---- API routes ---------------------------------------------------------------

app.get("/api/v1/health", (req, res) => res.json({ status: "ok" }));

app.get("/api/v1/stock/meta", (req, res) => {
  const exchange = req.query.exchange;
  const stocks = exchange
    ? STOCK_PREVIEWS.filter((s) => s.exchange === exchange)
    : STOCK_PREVIEWS;
  const sectors = [...new Set(stocks.map((s) => s.sector).filter(Boolean))].sort();
  const industries = [...new Set(stocks.map((s) => s.industry).filter(Boolean))].sort();
  const exchanges = [...new Set(STOCK_PREVIEWS.map((s) => s.exchange).filter(Boolean))].sort();
  res.json({ exchanges, sectors, industries });
});

app.get("/api/v1/stock", (req, res) => {
  const exchanges = [].concat(req.query.exchanges || []);
  const sectors = [].concat(req.query.sectors || []);
  const industries = [].concat(req.query.industries || []);
  const minEodVolume = parseInt(req.query.minEodVolume || "0", 10);
  const sortField = req.query.sortField || "eodVolume";
  const sortAsc = req.query.sortAsc === "true";
  const limit = Math.min(parseInt(req.query.limit || "50", 10), 500);
  const offset = parseInt(req.query.offset || "0", 10);

  let results = STOCK_PREVIEWS.filter((s) => {
    if (exchanges.length && !exchanges.includes(s.exchange)) return false;
    if (sectors.length && !sectors.includes(s.sector)) return false;
    if (industries.length && !industries.includes(s.industry)) return false;
    if (minEodVolume && s.eodVolume < minEodVolume) return false;
    return true;
  });

  results.sort((a, b) => {
    let va = sortField === "symbol" ? a.symbol : sortField === "close" ? (a.close ?? 0) : (a.eodVolume ?? 0);
    let vb = sortField === "symbol" ? b.symbol : sortField === "close" ? (b.close ?? 0) : (b.eodVolume ?? 0);
    if (typeof va === "string") return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortAsc ? va - vb : vb - va;
  });

  const total = results.length;
  results = results.slice(offset, offset + limit);
  res.json({ total, results });
});

app.get("/api/v1/stock/:symbol/quote", (req, res) => {
  const sym = decodeURIComponent(req.params.symbol).toUpperCase();
  const stock = STOCK_PREVIEWS.find((s) => s.symbol === sym);
  if (!stock) return res.status(404).json({ code: "NOT_FOUND", message: `Symbol ${sym} not found` });
  res.json(stock);
});

app.post("/api/v1/indicators/ma-cross/analyze", (req, res) => {
  const { symbols, maShort = 50, maLong = 200 } = req.body || {};
  if (!Array.isArray(symbols) || symbols.length === 0)
    return res.status(400).json({ code: "INVALID_ARGUMENT", message: "symbols must be a non-empty array" });
  if (maShort >= maLong)
    return res.status(400).json({ code: "INVALID_ARGUMENT", message: "maShort must be less than maLong" });

  const known = symbols.filter((s) => STOCK_PREVIEWS.some((p) => p.symbol === s.toUpperCase()));
  if (known.length === 0)
    return res.status(404).json({ code: "NOT_FOUND", message: "No data found for the requested symbols" });

  const results = known.map((sym) => ({
    symbol: sym.toUpperCase(),
    crossSignals: makeCrossSignals(sym.toUpperCase(), maShort, maLong),
  }));

  res.json({ requestId: crypto.randomUUID(), results });
});

app.post("/api/v1/screen/equity/search", (req, res) => {
  const {
    exchanges = [],
    sectors = [],
    industries = [],
    minEodVolume = 0,
    maxEodVolume,
    minClose,
    maxClose,
    sortField = "eodVolume",
    sortAsc = false,
    limit = 100,
    offset = 0,
  } = req.body || {};

  if (!Array.isArray(exchanges) || exchanges.length === 0)
    return res.status(400).json({ code: "INVALID_ARGUMENT", message: "exchanges is required" });

  let results = STOCK_PREVIEWS.filter((s) => {
    if (!exchanges.includes(s.exchange)) return false;
    if (sectors.length && !sectors.includes(s.sector)) return false;
    if (industries.length && !industries.includes(s.industry)) return false;
    if (minEodVolume && s.eodVolume < minEodVolume) return false;
    if (maxEodVolume && s.eodVolume > maxEodVolume) return false;
    if (minClose != null && s.close < minClose) return false;
    if (maxClose != null && s.close > maxClose) return false;
    return true;
  });

  results.sort((a, b) => {
    let va = sortField === "symbol" ? a.symbol : sortField === "close" ? (a.close ?? 0) : (a.eodVolume ?? 0);
    let vb = sortField === "symbol" ? b.symbol : sortField === "close" ? (b.close ?? 0) : (b.eodVolume ?? 0);
    if (typeof va === "string") return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortAsc ? va - vb : vb - va;
  });

  const total = results.length;
  results = results.slice(offset, Math.min(offset + limit, 500));
  res.json({ requestId: crypto.randomUUID(), total, results });
});

// ---- Serve frontend -----------------------------------------------------------

app.use(express.static(DIST_DIR));

// SPA fallback – unknown routes return index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

// ---- Start --------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] API endpoints:`);
  console.log(`[server]   GET  /api/v1/health`);
  console.log(`[server]   GET  /api/v1/stock`);
  console.log(`[server]   GET  /api/v1/stock/:symbol/quote`);
  console.log(`[server]   POST /api/v1/indicators/ma-cross/analyze`);
  console.log(`[server]   POST /api/v1/screen/equity/search`);
  console.log(`[server] Frontend: ${DIST_DIR}`);
});
