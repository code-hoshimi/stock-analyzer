#pragma once
#include <vector>

#include "indicator.pb.h"
#include "models.h"

std::vector<CrossSignal> detect_ma_cross(
    const std::vector<Price>& prices,
    int short_period = 20,
    int long_period  = 60);

std::vector<RSIValue> calculate_rsi(
    const std::vector<Price>& prices,
    int period = 14
);

std::vector<OBVValue> calculate_obv(
    const std::vector<Price>& prices,
    int rising_window = 5
);


// ── Helpers ───────────────────────────────────────────────────────────────────

// Convert existing CrossType enum to proto CrossType
static indicator::CrossType to_proto_cross_type(::CrossType ct) {
    switch (ct) {
        case ::CrossType::GOLDEN_CROSS: return indicator::CrossType::GOLDEN_CROSS;
        case ::CrossType::DEATH_CROSS:  return indicator::CrossType::DEATH_CROSS;
        default:                        return indicator::CrossType::GOLDEN_CROSS;
    }
}

// Convert existing AnalysisResult struct to proto CrossSignal
static indicator::CrossSignal to_proto_cross_signal(const ::AnalysisResult& r) {
    indicator::CrossSignal proto;

    proto.set_datetime(r.datetime);
    proto.set_is_buy_signal(r.is_buy_signal);
    proto.set_note(r.note);

    // CrossSignal
    proto.set_cross_type(to_proto_cross_type(r.cross.cross_type));
    proto.set_ma_short(r.cross.ma_short);
    proto.set_ma_long(r.cross.ma_long);
    proto.set_close(r.cross.close);
    proto.set_rsi(r.rsi.rsi);
    proto.set_obv(r.obv.obv);
    proto.set_is_obv_rising(r.obv.is_rising);

    return proto;
}