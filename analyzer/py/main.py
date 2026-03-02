import os
import sqlite3
import time


def analyze(db_path: str) -> None:
    con = sqlite3.connect(db_path)
    cur = con.cursor()

    rows = cur.execute(
        "SELECT symbol, datetime, close FROM stock_prices ORDER BY datetime DESC LIMIT 10"
    ).fetchall()

    if not rows:
        print("No data yet.")
        return

    print(f"Latest 10 records:")
    for symbol, dt, close in rows:
        print(f"  {symbol}  {dt}  close={close}")

    con.close()


if __name__ == "__main__":
    db_path = os.environ.get("DB_PATH", "/data/stocks.db")
    interval = int(os.environ.get("INTERVAL_SECONDS", "60"))

    print(f"Python analyzer starting — db={db_path}, interval={interval}s")
    while True:
        try:
            analyze(db_path)
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(interval)
