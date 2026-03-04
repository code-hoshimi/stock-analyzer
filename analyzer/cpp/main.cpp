#include <cstdlib>
#include <cstring>
#include <cmath>
#include <iostream>
#include <iomanip>
#include <string>
#include <vector>
#include <algorithm>
#include <sqlite3.h>

#include "sql_client.h"

struct single_price {
    std::string symbol;
    std::string label;
    double price;
};

void draw(const std::vector<single_price>& output) {
    const int H = 10, W = output.size();
    double lo = std::min_element(output.begin(), output.end(), [](const single_price& a, const single_price& b) {
        return a.price < b.price;
    })->price;
    double hi = std::max_element(output.begin(), output.end(), [](const single_price& a, const single_price& b) {
        return a.price < b.price;
    })->price;
    if (hi == lo) hi = lo + 1;

    // Map each price to its nearest row (single dot)
    auto dot_row = [&](int c) {
        return (int)std::round((output[c].price - lo) / (hi - lo) * H);
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
        std::string label = output[c].label;
        std::string t = (label.size() >= 16) ? label.substr(11, 5) : label;
        std::cout << std::left << std::setw(step * 3) << t;
    }
    std::cout << "\n";
}

void analyze(const std::string& db_path) {
    std::vector<single_price> output;
    hoshimi::sql_client::query(db_path,
        "SELECT symbol, datetime, close FROM stock_prices ORDER BY datetime ASC LIMIT 60;",
        output,
        [](sqlite3_stmt* stmt) -> single_price {
            return single_price {
                .symbol = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0)),
                .label = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1)),
                .price = std::stod(reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2))),
            };
        }
    );
    if (output.empty()) { std::cout << "No data yet.\n"; return; }

    std::cout << "\n  " << output[0].symbol << " close price\n\n";
    draw(output);
}

int main() {
    const char* db_path_env = std::getenv("DB_PATH");
    std::string db_path = db_path_env ? db_path_env : "/data/stocks.db";

    std::cout << "C++ analyzer starting — db=" << db_path << "\n";
    analyze(db_path);
}

