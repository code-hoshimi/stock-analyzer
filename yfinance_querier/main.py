import os
import sys
import sqlite3
import logging
import yfinance as yf

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", stream=sys.stdout)
log = logging.getLogger(__name__)

SYMBOLS = [
    "0700.HK",  # 腾讯控股
    "9988.HK",  # 阿里巴巴
    "3690.HK",  # 美团
    "9999.HK",  # 网易
    "1810.HK",  # 小米集团
    "9618.HK",  # 京东集团
    "0241.HK",  # 阿里健康
    "2382.HK",  # 舜宇光学
    "0992.HK",  # 联想集团
    "6690.HK",  # 海尔智家
]


def init_db(conn: sqlite3.Connection):
    conn.executescript("""
        PRAGMA journal_mode=WAL;
        PRAGMA busy_timeout=5000;

        CREATE TABLE IF NOT EXISTS stock_prices (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol    TEXT    NOT NULL,
            interval  TEXT    NOT NULL,
            datetime  TEXT    NOT NULL,
            open      REAL    NOT NULL,
            high      REAL    NOT NULL,
            low       REAL    NOT NULL,
            close     REAL    NOT NULL,
            adj_close REAL    NOT NULL,
            volume    INTEGER NOT NULL,
            UNIQUE(symbol, interval, datetime)
        );
    """)
    conn.commit()
    log.info("Database initialized")


def fetch_and_store(conn: sqlite3.Connection, symbol: str, interval: str, period: str) -> int:
    log.info("Fetching %s | interval=%s period=%s", symbol, interval, period)

    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval, auto_adjust=False) # auto_adjust = false, 复权价，计算 MA 用这个
    except Exception as e:
        log.error("Failed to fetch %s: %s", symbol, e)
        return 0

    if df.empty:
        log.warning("No data returned for %s", symbol)
        return 0

    # delete old data for ease of testing
    conn.execute("DELETE FROM stock_prices WHERE symbol = ?", (symbol,))

    rows = []
    for ts, row in df.iterrows():
        try:
            rows.append((
                symbol,
                interval,
                str(ts),
                float(row["Open"]),
                float(row["High"]),
                float(row["Low"]),
                float(row["Close"]),
                float(row["Adj Close"]),
                int(row["Volume"]),
            ))
        except (KeyError, ValueError) as e:
            log.warning("Skipping row for %s at %s: %s", symbol, ts, e)
            continue

    if not rows:
        log.warning("No valid rows to insert for %s", symbol)
        return 0

    conn.executemany("""
        INSERT INTO stock_prices
            (symbol, interval, datetime, open, high, low, close, adj_close, volume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    conn.commit()

    log.info("Stored %d records for %s", len(rows), symbol)
    return len(rows)


def main():
    db_path  = os.environ.get("DB_PATH",  "/data/stocks.db")
    interval = os.environ.get("INTERVAL", "1d")
    period   = os.environ.get("PERIOD",   "6mo")  # 120 days

    # comma separated list of symbols: SYMBOLS="0700.HK,9988.HK"
    symbols_env = os.environ.get("SYMBOLS", "")
    symbols = [s.strip() for s in symbols_env.split(",") if s.strip()] if symbols_env else SYMBOLS

    log.info("Starting querier | db=%s interval=%s period=%s", db_path, interval, period)
    log.info("Symbols: %s", symbols)

    conn = sqlite3.connect(db_path)
    try:
        init_db(conn)

        total = 0
        failed = []
        for symbol in symbols:
            count = fetch_and_store(conn, symbol, interval, period)
            if count == 0:
                failed.append(symbol)
            else:
                total += count

        log.info("Done. Total records stored: %d", total)
        if failed:
            log.warning("Failed or empty symbols: %s", failed)

    finally:
        conn.close()


if __name__ == "__main__":
    main()