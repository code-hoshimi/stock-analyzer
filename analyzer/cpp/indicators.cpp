#include "indicators.h"

// ─────────────────────────────────────────
// 1. MA Cross
// ─────────────────────────────────────────

std::vector<CrossSignal> detect_ma_cross(
    const std::vector<Price>& prices,
    int short_period,
    int long_period
) {
    std::vector<CrossSignal> signals;
    int n = prices.size();

    if (n < long_period + 1) return signals; // 数据不足

    // 计算每天的 MA，从 long_period - 1 开始才有完整 MA60
    // 是 O(n × period) 的复杂度，对 10 只股票 120 天数据完全没问题。如果以后股票数量大幅增加，可以换成滑动窗口优化。
    auto calc_ma = [&](int idx, int period) -> double {
        double sum = 0.0;
        for (int i = idx - period + 1; i <= idx; ++i) {
            sum += prices[i].adj_close;
        }
        return sum / period;
    };

    for (int i = long_period; i < n; ++i) {
        double ma_short_today = calc_ma(i,     short_period);
        double ma_long_today  = calc_ma(i,     long_period);
        double ma_short_prev  = calc_ma(i - 1, short_period);
        double ma_long_prev   = calc_ma(i - 1, long_period);

        // 金叉：今天 short > long，昨天 short < long
        if (ma_short_today > ma_long_today && ma_short_prev < ma_long_prev) {
            signals.push_back({
                .symbol     = prices[i].symbol,
                .datetime   = prices[i].datetime,
                .cross_type = CrossType::GOLDEN_CROSS,
                .ma_short   = ma_short_today,
                .ma_long    = ma_long_today,
                .close      = prices[i].close,
            });
        }
        // 死叉：今天 short < long，昨天 short > long
        else if (ma_short_today < ma_long_today && ma_short_prev > ma_long_prev) {
            signals.push_back({
                .symbol     = prices[i].symbol,
                .datetime   = prices[i].datetime,
                .cross_type = CrossType::DEATH_CROSS,
                .ma_short   = ma_short_today,
                .ma_long    = ma_long_today,
                .close      = prices[i].close,
            });
        }
    }

    return signals;
}

// ─────────────────────────────────────────
// 2. RSI
// ─────────────────────────────────────────

std::vector<RSIValue> calculate_rsi(
    const std::vector<Price>& prices,
    int period
) {
    std::vector<RSIValue> result;
    int n = prices.size();

    if (n < period + 1) return result;

    // 第一个 avg_gain / avg_loss 用简单平均
    double avg_gain = 0.0;
    double avg_loss = 0.0;

    for (int i = 1; i <= period; ++i) {
        double change = prices[i].close - prices[i - 1].close;
        if (change > 0) avg_gain += change;
        else            avg_loss += std::abs(change);
    }
    avg_gain /= period;
    avg_loss /= period;

    auto calc_rsi = [&]() -> double {
        if (avg_loss == 0.0) return 100.0;
        double rs = avg_gain / avg_loss;
        return 100.0 - (100.0 / (1.0 + rs));
    };

    result.push_back({ prices[period].datetime, calc_rsi() });

    // 之后用 Wilder 平滑
    for (int i = period + 1; i < n; ++i) {
        double change = prices[i].close - prices[i - 1].close;
        double gain   = change > 0 ? change : 0.0;
        double loss   = change < 0 ? std::abs(change) : 0.0;

        avg_gain = (avg_gain * (period - 1) + gain) / period;
        avg_loss = (avg_loss * (period - 1) + loss) / period;

        result.push_back({ prices[i].datetime, calc_rsi() });
    }

    return result;
}

// ─────────────────────────────────────────
// 3. OBV
// ─────────────────────────────────────────

std::vector<OBVValue> calculate_obv(
    const std::vector<Price>& prices,
    int rising_window
) {
    std::vector<OBVValue> result;
    int n = prices.size();

    if (n < 2) return result;

    long long obv = 0;
    result.push_back({ prices[0].datetime, obv, false });

    for (int i = 1; i < n; ++i) {
        if      (prices[i].close > prices[i - 1].close) obv += prices[i].volume;
        else if (prices[i].close < prices[i - 1].close) obv -= prices[i].volume;
        // 平盘不变

        // 判断过去 rising_window 天是否持续上升
        bool is_rising = false;
        if ((int)result.size() >= rising_window) {
            is_rising = true;
            for (int j = result.size() - rising_window + 1; j < (int)result.size(); ++j) {
                if (result[j].obv <= result[j - 1].obv) {
                    is_rising = false;
                    break;
                }
            }
            // 还要确认当前 obv 比上一个高
            if (obv <= result.back().obv) is_rising = false;
        }

        result.push_back({ prices[i].datetime, obv, is_rising });
    }

    return result;
}