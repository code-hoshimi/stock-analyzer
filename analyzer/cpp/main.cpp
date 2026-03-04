#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>
#include <sqlite3.h>

#include "sql/sql_client.h"
#include "models/models.h"
#include "utils/drawer.h"
#include "indicators.h"
#include "analyzers.h"

int main() {
    const char* db_path_env = std::getenv("DB_PATH");
    std::string db_path = db_path_env ? db_path_env : "/data/stocks.db";

    const char* symbol_env = std::getenv("SYMBOL");
    std::string symbol = symbol_env ? symbol_env : "0700.HK";

    std::cout << "C++ analyzer starting — db=" << db_path << "\n";
    std::vector<Price> prices;
    hoshimi::sql_client::query(db_path,
        "SELECT symbol, interval, datetime, open, high, low, close, adj_close, volume FROM stock_prices WHERE symbol = '" + symbol + "' ORDER BY datetime ASC;",
        prices,
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
    if (prices.empty()) { std::cout << "No data yet.\n"; return 0; }

    const std::string& analyze_symbol = prices.front().symbol;
    std::string cutoff = "2024-01-01";

    auto crosses = detect_ma_cross(prices);
    auto rsi     = calculate_rsi(prices);
    auto obv     = calculate_obv(prices);
    auto results = analyze(crosses, rsi, obv, cutoff);

    print_results(results, crosses, analyze_symbol, true);

    return 0;
}

