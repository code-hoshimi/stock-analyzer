#pragma once

#include <string>

struct SimplePrice {
    std::string symbol;
    std::string label;
    double price;
};

struct Price {
    std::string symbol;
    std::string interval;
    std::string datetime;
    double open;
    double high;
    double low;
    double close;
    double adj_close;
    long long volume; // int64，corresponding to sqlite3_column_int64
};

enum class CrossType {
    GOLDEN_CROSS,
    DEATH_CROSS
};

struct CrossSignal {
    std::string symbol;
    std::string datetime;
    CrossType   cross_type;
    double      ma_short;
    double      ma_long;
    double      close;
};

struct RSIValue {
    std::string datetime;
    double      rsi;
};

struct OBVValue {
    std::string datetime;
    long long   obv;
    bool        is_rising;
};

struct AnalysisResult {
    std::string symbol;
    std::string datetime;
    CrossSignal cross;
    RSIValue    rsi;
    OBVValue    obv;
    bool        is_buy_signal;
    std::string note;
};