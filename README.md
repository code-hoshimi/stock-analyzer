# Stock Analyzer — Configuration Reference

> **Buy signal = MA Golden Cross + RSI < 70 + OBV rising (all three must be true)**
>
> Data window: 120 trading days (~6 months)

---

## 1. Environment Variables

### 1.1 Querier (`querier.py`)

| Parameter  | Default           | Range                        | Effect |
|------------|-------------------|------------------------------|--------|
| `DB_PATH`  | `/data/stocks.db` | Any file path                | Location of the SQLite database file |
| `SYMBOLS`  | *(hardcoded 10)*  | Comma-separated HK tickers   | Override the default symbol list e.g. `0700.HK,9988.HK`. Leave empty to use the built-in list |
| `INTERVAL` | `1d`              | `1d` / `1wk`                 | Bar size of price data. Changing to `1wk` reduces data points and smooths indicators |
| `PERIOD`   | `6mo`             | `3mo` / `6mo` / `1y` / `2y` | How far back to fetch. Must be long enough to warm up MA60 (≥ 60 trading days). `6mo` ≈ 120 days is recommended |

### 1.2 Analyzer (`analyzer_cpp`)

| Parameter | Default           | Range          | Effect |
|-----------|-------------------|----------------|--------|
| `DB_PATH` | `/data/stocks.db` | Any file path  | Must match the path used by the querier |
| `SYMBOL`  | `0700.HK`         | Any HK ticker  | Single stock to analyze. Run once per symbol or loop in a shell script |

---

## 2. MA Golden Cross Parameters

Passed to `detect_ma_cross()`. A golden cross occurs when the short-period MA crosses above the long-period MA.

| Parameter      | Default | Range    | Effect |
|----------------|---------|----------|--------|
| `short_period` | `20`    | `5–50`   | Days for the fast moving average. Smaller = more sensitive, more frequent crossovers, more noise |
| `long_period`  | `60`    | `30–200` | Days for the slow moving average. Larger = smoother trend, fewer but more reliable signals |

**Common combinations:**

| Combination    | Character |
|----------------|-----------|
| MA5 × MA20     | Short-term, high frequency, noisy |
| MA20 × MA60    | Medium-term, current default, balanced |
| MA50 × MA200   | Long-term Golden Cross, rare but strong signal |

---

## 3. RSI Parameters

Passed to `calculate_rsi()`. RSI measures momentum — how overbought or oversold a stock is.

| Parameter               | Default | Range   | Effect |
|-------------------------|---------|---------|--------|
| `period`                | `14`    | `7–28`  | Lookback window. Smaller = more reactive, larger = smoother. 14 is the Wilder standard |

**RSI interpretation:**

```
RSI > 70  →  overbought, buy signal blocked
RSI 40–70 →  neutral to bullish, buy signal allowed
RSI < 30  →  oversold, potential reversal
```

---

## 4. OBV Parameters

Passed to `calculate_obv()`. OBV confirms whether volume supports the price trend.

| Parameter      | Default | Range  | Effect |
|----------------|---------|--------|--------|
| `rising_window`| `5`     | `3–10` | Consecutive days OBV must increase to be considered rising. Decrease to 3 for more lenient confirmation; increase to 7 for stricter |

**Modes:**
- **Strict (window=5):** requires sustained buying pressure over a full week
- **Lenient (window=3):** triggers after 3 days of net inflow — more signals, more false positives

---

## 5. Observation Window

Controls which golden crosses are included in the monthly report.

| Parameter     | Default        | Range                  | Effect |
|---------------|----------------|------------------------|--------|
| `cutoff_date` | 30 days ago    | Any `YYYY-MM-DD` string | Golden crosses before this date are ignored. Set to the first day of the current month to see only this month's signals |

> The first 60 days of fetched data are used purely to warm up MA60 and are never reported.

---

## 6. Quick Reference

### Increase signal frequency

| Change | Trade-off |
|--------|-----------|
| Decrease `short_period` (e.g. 20 → 10) | More crossovers, more false positives |
| Decrease `long_period` (e.g. 60 → 30) | Faster trend detection, less reliable |
| Increase `overbought_threshold` (70 → 75) | Allows signals in stronger uptrends |
| Decrease `rising_window` (5 → 3) | Looser volume confirmation |

### Increase signal reliability

| Change | Trade-off |
|--------|-----------|
| Increase `long_period` (e.g. 60 → 200) | Fewer signals, only strong trends |
| Decrease `overbought_threshold` (70 → 65) | Stricter momentum filter |
| Increase `rising_window` (5 → 7) | Requires longer volume confirmation |
| Increase RSI `period` (14 → 21) | Smoother RSI, less reactive to short spikes |