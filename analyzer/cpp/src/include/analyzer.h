#pragma once

#include <string>
#include <vector>

#include "models.h"

std::vector<AnalysisResult> analyze(
    const std::vector<CrossSignal>& crosses,
    const std::vector<RSIValue>&    rsi,
    const std::vector<OBVValue>&    obv,
    const std::string&              cutoff_date  // only check signals after this date
);