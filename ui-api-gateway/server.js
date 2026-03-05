"use strict";

const express = require("express");
const sqlite3 = require("sqlite3");
const { createProxyMiddleware } = require("http-proxy-middleware");

const PORT = parseInt(process.env.PORT || "8080", 10);
const DB_PATH = process.env.DB_PATH || "/data/stocks.db";

// Where the Rust data server is reachable.
const DATA_SERVER_BASE = process.env.DATA_SERVER_BASE || "http://localhost:3881";

// Basic sanity limits so "num" can't accidentally melt your server.
const DEFAULT_NUM = 50;
const MAX_NUM = 500;

function parseNum(q) {
  if (q === undefined || q === null || q === "") return DEFAULT_NUM;
  const n = Number(q);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < 1) return null;
  return Math.min(i, MAX_NUM);
}

function parseSymbol(q) {
  if (typeof q !== "string") return null;
  const s = q.trim();
  if (!s) return null;
  // Keep it permissive but not ridiculous; adjust as you like.
  if (s.length > 20) return null;
  return s.toUpperCase();
}

// Open sqlite DB (read-only is possible, but keep default for now).
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error(`[DB] Failed to open DB at ${DB_PATH}:`, err.message);
  } else {
    console.log(`[DB] Opened sqlite DB: ${DB_PATH}`);
  }
});

function allAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

const app = express();
app.disable("x-powered-by");

// Health check
app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

// ---- Vanilla APIs ----
//
// GET /api/vanillia/recent?num=...
app.get("/api/vanillia/recent", async (req, res) => {
  const num = parseNum(req.query.num);
  if (num === null) {
    return res.status(400).json({ error: "Invalid query: num must be a positive integer" });
  }

  try {
    const rows = await allAsync(
      `
      SELECT id, symbol, interval, datetime, open, high, low, close, adj_close, volume
      FROM stock_prices
      ORDER BY datetime DESC, id DESC
      LIMIT ?
      `,
      [num]
    );
    res.json(rows);
  } catch (e) {
    console.error("[API] /api/vanillia/recent error:", e);
    res.status(500).json({ error: "DB query failed" });
  }
});

// GET /api/vanillia/symbol?num=...&symbol=...
app.get("/api/vanillia/symbol", async (req, res) => {
  const num = parseNum(req.query.num);
  if (num === null) {
    return res.status(400).json({ error: "Invalid query: num must be a positive integer" });
  }

  const symbol = parseSymbol(req.query.symbol);
  if (symbol === null) {
    return res.status(400).json({ error: "Invalid query: symbol is required" });
  }

  try {
    const rows = await allAsync(
      `
      SELECT id, symbol, interval, datetime, open, high, low, close, adj_close, volume
      FROM stock_prices
      WHERE symbol = ?
      ORDER BY datetime DESC, id DESC
      LIMIT ?
      `,
      [symbol, num]
    );
    res.json(rows);
  } catch (e) {
    console.error("[API] /api/vanillia/symbol error:", e);
    res.status(500).json({ error: "DB query failed" });
  }
});

// ---- Proxy to data server (Rust server) ----
//
// Rust server routes:
//   POST /fetch
//   GET  /analyze/:symbol
//   GET  /indicators
//
// We expose them under:
//   /api/data/fetch        -> http://<DATA_SERVER_BASE>/fetch
//   /api/data/analyze/AAPL -> http://<DATA_SERVER_BASE>/analyze/AAPL
//   /api/data/indicators   -> http://<DATA_SERVER_BASE>/indicators
//
app.use(
  "/api/data",
  createProxyMiddleware({
    target: DATA_SERVER_BASE,
    changeOrigin: false,
    pathRewrite: (path) => path.replace(/^\/api\/data/, ""),
    // If data server is down, return JSON (helpful for frontend/dev)
    onError: (err, req, res) => {
      console.error("[PROXY] data server error:", err?.message || err);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Data service unavailable",
          target: DATA_SERVER_BASE
        });
      }
    }
  })
);

app.listen(PORT, () => {
  console.log(`[API] listening on :${PORT}`);
  console.log(`[API] DB_PATH=${DB_PATH}`);
  console.log(`[API] DATA_SERVER_BASE=${DATA_SERVER_BASE}`);
});

// Graceful shutdown
function shutdown() {
  console.log("[SYS] shutting down...");
  db.close(() => {
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
