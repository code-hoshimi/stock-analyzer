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

// ── JSON helpers ──────────────────────────────────────────────────────────

// Simple JSON string escape
static std::string json_escape(const std::string& s) {
    std::string out;
    for (char c : s) {
        if      (c == '"')  out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else if (c == '\n') out += "\\n";
        else                out += c;
    }
    return out;
}

// ── Output ────────────────────────────────────────────────────────────────

static void print_results_json(const std::vector<AnalysisResult>& results,
    const std::vector<CrossSignal>& crosses,
    const std::string& symbol,
    bool verbose = false) {
    std::ostringstream o;
    o << std::fixed << std::setprecision(2);

    o << "{\n";
    o << "  \"symbol\": \"" << json_escape(symbol) << "\",\n";

    // ── buy signals ──
    o << "  \"signals\": [";
    bool first_signal = true;
    for (const auto& r : results) {
        if (!r.is_buy_signal) continue;
        if (!first_signal) o << ",";
        first_signal = false;
        o << "\n    {\n";
        o << "      \"datetime\": \""  << json_escape(r.datetime)    << "\",\n";
        o << "      \"is_buy_signal\": true,\n";
        o << "      \"ma20\": "        << r.cross.ma_short            << ",\n";
        o << "      \"ma60\": "        << r.cross.ma_long             << ",\n";
        o << "      \"rsi\": "         << std::setprecision(1)
                                       << r.rsi.rsi                   << ",\n";
        o << "      \"obv_rising\": "  << (r.obv.is_rising ? "true" : "false") << ",\n";
        o << "      \"note\": \""      << json_escape(r.note)         << "\"\n";
        o << "    }";
    }
    o << "\n  ]";

    // ── verbose: all crosses ──
    if (verbose) {
        o << ",\n  \"debug\": {\n";
        o << "    \"total_crosses\": " << crosses.size() << ",\n";
        o << "    \"all_crosses\": [";
        bool first_cross = true;
        for (const auto& c : crosses) {
            if (!first_cross) o << ",";
            first_cross = false;
            o << "\n      {\n";
            o << "        \"datetime\": \""  << json_escape(c.datetime) << "\",\n";
            o << "        \"type\": \""
              << (c.cross_type == CrossType::GOLDEN_CROSS ? "golden" : "death")
              << "\",\n";
            o << "        \"ma20\": "        << std::setprecision(2) << c.ma_short << ",\n";
            o << "        \"ma60\": "        << c.ma_long   << ",\n";
            o << "        \"close\": "       << c.close     << "\n";
            o << "      }";
        }
        o << "\n    ]\n  }";
    }

    o << "\n}\n";
    std::cout << o.str();
}