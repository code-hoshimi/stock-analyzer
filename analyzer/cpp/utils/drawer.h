#pragma once

#include <vector>
#include <string>
#include <algorithm>
#include <iomanip>
#include <cmath>
#include <iostream>

#include "../models/models.h"

static void draw(const std::vector<SimplePrice>& output) {
    const int H = 10, W = output.size();
    double lo = std::min_element(output.begin(), output.end(), [](const SimplePrice& a, const SimplePrice& b) {
        return a.price < b.price;
    })->price;
    double hi = std::max_element(output.begin(), output.end(), [](const SimplePrice& a, const SimplePrice& b) {
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
}

static void print_results(const std::vector<AnalysisResult>& results,
    const std::vector<CrossSignal>& crosses,
    const std::string& symbol,
    bool verbose = false) {

    std::cout << "\n── " << symbol << " ──────────────────────────\n";

    if (verbose) {
        std::cout << "\nAll crosses detected:\n";
        if (crosses.empty()) {
            std::cout << "  (none)\n";
        } else {
            for (const auto& c : crosses) {
                std::cout << "  "
                          << (c.cross_type == CrossType::GOLDEN_CROSS ? "GOLDEN" : "DEATH ")
                          << "  " << c.datetime
                          << "  MA20=" << std::fixed << std::setprecision(2) << c.ma_short
                          << "  MA60=" << c.ma_long
                          << "  close=" << c.close
                          << "\n";
            }
        }
        std::cout << "\nAnalysis per golden cross:\n";
        bool any_golden = false;
        for (const auto& r : results) {
            any_golden = true;
            std::cout << "  " << r.datetime
                      << "  RSI="    << std::setprecision(1) << r.rsi.rsi
                      << "  OBV_rising=" << (r.obv.is_rising ? "true" : "false")
                      << "  => " << (r.is_buy_signal ? "BUY" : "SKIP")
                      << "  (" << r.note << ")\n";
        }
        if (!any_golden) {
            std::cout << "  (no golden cross in observation window)\n";
        }
        std::cout << "\n";
    }

    bool any_signal = false;
    for (const auto& r : results) {
        if (!r.is_buy_signal) continue;
        any_signal = true;

        std::cout << "\n[BUY SIGNAL] " << r.symbol
                  << "  on " << r.datetime << "\n"
                  << "  MA short=" << std::fixed << std::setprecision(2) << r.cross.ma_short
                  << "  MA long=" << r.cross.ma_long << "\n"
                  << "  RSI=" << std::setprecision(1) << r.rsi.rsi << "\n"
                  << "  OBV rising: " << (r.obv.is_rising ? "true" : "false") << "\n"
                  << "  Note: " << r.note << "\n";
    }

    if (!any_signal) {
        // no signal for the entire data series
        std::string reason = "no golden cross throughout the duration";
        for (const auto& r : results) {
            reason = r.note;
            break;
        }
        std::cout << "No signal: " << symbol << "  (" << reason << ")\n";
    }
}