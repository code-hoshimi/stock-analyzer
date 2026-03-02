#include <cstdlib>
#include <cstring>
#include <cmath>
#include <iostream>
#include <iomanip>
#include <string>
#include <vector>
#include <algorithm>
#include <sqlite3.h>

void draw(const std::vector<double>& prices, const std::vector<std::string>& labels) {
    const int H = 10, W = prices.size();
    double lo = *std::min_element(prices.begin(), prices.end());
    double hi = *std::max_element(prices.begin(), prices.end());
    if (hi == lo) hi = lo + 1;

    // Map each price to its nearest row (single dot)
    auto dot_row = [&](int c) {
        return (int)std::round((prices[c] - lo) / (hi - lo) * H);
    };

    for (int row = H; row >= 0; --row) {
        double val = lo + (hi - lo) * row / H;
        std::cout << std::setw(8) << std::fixed << std::setprecision(2) << val << " |";
        for (int c = 0; c < W; ++c)
            std::cout << ((dot_row(c) == row) ? " * " : "   ");
        std::cout << "\n";
    }
    std::cout << "         +" << std::string(W * 3, '-') << "\n";

    // Extract HH:MM from "YYYY-MM-DD HH:MM:SS", print every Nth label
    int step = std::max(1, W / 8);
    std::cout << "          ";
    for (int c = 0; c < W; c += step) {
        std::string t = (labels[c].size() >= 16) ? labels[c].substr(11, 5) : labels[c];
        std::cout << std::left << std::setw(step * 3) << t;
    }
    std::cout << "\n";
}

void analyze(const std::string& db_path) {
    sqlite3* db = nullptr;
    if (sqlite3_open(db_path.c_str(), &db) != SQLITE_OK) {
        std::cerr << "Cannot open database: " << sqlite3_errmsg(db) << "\n";
        return;
    }

    const char* sql =
        "SELECT symbol, datetime, close FROM stock_prices ORDER BY datetime ASC LIMIT 60;";

    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        std::cerr << "Failed to prepare statement: " << sqlite3_errmsg(db) << "\n";
        sqlite3_close(db);
        return;
    }

    std::string symbol;
    std::vector<double> prices;
    std::vector<std::string> labels;
    while (sqlite3_step(stmt) == SQLITE_ROW) {
        symbol   = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
        labels.push_back(reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1)));
        prices.push_back(std::stod(reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2))));
    }
    sqlite3_finalize(stmt);
    sqlite3_close(db);

    if (prices.empty()) { std::cout << "No data yet.\n"; return; }

    std::cout << "\n  " << symbol << " close price\n\n";
    draw(prices, labels);
}

int main() {
    const char* db_path_env = std::getenv("DB_PATH");
    std::string db_path = db_path_env ? db_path_env : "/data/stocks.db";

    std::cout << "C++ analyzer starting — db=" << db_path << "\n";
    analyze(db_path);
}

