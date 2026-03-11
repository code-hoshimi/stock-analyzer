#pragma once

#include <string>
#include <vector>

#include "sql_client.h"

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

static std::vector<Price> query_prices(const std::string& db_path, const std::string& symbol) {
    std::vector<Price> prices;
    hoshimi::sql_client::query(db_path,
        "SELECT symbol, interval, datetime, open, high, low, close, adj_close, volume "
        "FROM stock_prices WHERE symbol = ? ORDER BY datetime ASC;",
        prices,
        [&symbol](sqlite3_stmt*& stmt) -> bool {
            return sqlite3_bind_text(stmt, 1, symbol.c_str(), -1, SQLITE_STATIC);
        },
        [](sqlite3_stmt* stmt) -> Price {
            return Price {
                .symbol    = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0)),
                .interval  = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1)),
                .datetime  = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2)),
                .open      = sqlite3_column_double(stmt, 3),
                .high      = sqlite3_column_double(stmt, 4),
                .low       = sqlite3_column_double(stmt, 5),
                .close     = sqlite3_column_double(stmt, 6),
                .adj_close = sqlite3_column_double(stmt, 7),
                .volume    = sqlite3_column_int64(stmt, 8),
            };
        }
    );
    return prices;
}