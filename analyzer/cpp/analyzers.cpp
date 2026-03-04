#include <unordered_map>

#include "analyzers.h"

std::vector<AnalysisResult> analyze(
    const std::vector<CrossSignal>& crosses,
    const std::vector<RSIValue>&    rsi,
    const std::vector<OBVValue>&    obv,
    const std::string&              cutoff_date
) {
    std::unordered_map<std::string, RSIValue> rsi_map;
    for (const auto& r : rsi) rsi_map[r.datetime] = r;

    std::unordered_map<std::string, OBVValue> obv_map;
    for (const auto& o : obv) obv_map[o.datetime] = o;

    std::vector<AnalysisResult> results;

    for (const auto& cross : crosses) {
        if (cross.cross_type != CrossType::GOLDEN_CROSS) continue;

        if (cross.datetime < cutoff_date) continue;

        auto rsi_it = rsi_map.find(cross.datetime);
        auto obv_it = obv_map.find(cross.datetime);

        if (rsi_it == rsi_map.end()) continue;
        if (obv_it == obv_map.end()) continue;

        const RSIValue& rsi_val = rsi_it->second;
        const OBVValue& obv_val = obv_it->second;

        bool rsi_ok  = rsi_val.rsi < 70.0; // overbought_theshold
        bool obv_ok  = obv_val.is_rising;
        bool is_buy  = rsi_ok && obv_ok;

        std::string note;
        if (is_buy) {
            note = "BUY: Golden cross"
                 + std::string(", RSI=")
                 + std::to_string(rsi_val.rsi).substr(0, 5)
                 + ", OBV rising";
        } else {
            if (!rsi_ok)
                note += "RSI overbought(" + std::to_string(rsi_val.rsi).substr(0, 5) + ") ";
            if (!obv_ok)
                note += "OBV not rising";
        }

        results.push_back({
            .symbol       = cross.symbol,
            .datetime     = cross.datetime,
            .cross        = cross,
            .rsi          = rsi_val,
            .obv          = obv_val,
            .is_buy_signal = is_buy,
            .note         = note,
        });
    }

    return results;
}