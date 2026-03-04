import os
import sqlite3
import logging
import yfinance as yf

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


def init_db(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS stock_prices (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol    TEXT    NOT NULL,
            interval  TEXT    NOT NULL,
            datetime  TEXT    NOT NULL,
            open      TEXT    NOT NULL,
            high      TEXT    NOT NULL,
            low       TEXT    NOT NULL,
            close     TEXT    NOT NULL,
            volume    TEXT    NOT NULL,
            UNIQUE(symbol, interval, datetime)
        )
    """)
    conn.commit()
    return conn


def fetch_and_store(conn: sqlite3.Connection, symbol: str, interval: str, period: str) -> int:
    log.info("Fetching %s | interval=%s period=%s", symbol, interval, period)
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period, interval=interval)

    if df.empty:
        log.warning("No data returned for %s", symbol)
        return 0

    rows = []
    for ts, row in df.iterrows():
        dt_str = str(ts)
        rows.append((
            symbol,
            interval,
            dt_str,
            str(row["Open"]),
            str(row["High"]),
            str(row["Low"]),
            str(row["Close"]),
            str(int(row["Volume"])),
        ))

    conn.executemany("""
        INSERT OR REPLACE INTO stock_prices
            (symbol, interval, datetime, open, high, low, close, volume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    conn.commit()
    return len(rows)


def main():
    db_path = os.environ.get("DB_PATH", "/data/stocks.db")
    symbol   = os.environ.get("SYMBOL",   "AAPL")
    interval = os.environ.get("INTERVAL", "1m")
    period   = os.environ.get("PERIOD",   "1d")

    conn = init_db(db_path)
    try:
        count = fetch_and_store(conn, symbol, interval, period)
        log.info("Stored %d records for %s into %s", count, symbol, db_path)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
