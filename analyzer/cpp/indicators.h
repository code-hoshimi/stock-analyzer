#pragma once
#include <vector>

#include "models/models.h"

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