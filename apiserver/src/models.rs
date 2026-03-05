use serde::Serialize;
use serde_json::Value;

// ── API responses ─────────────────────────────────────────────────────────

// Transparent passthrough — C++ owns the schema.
// Rust does not define any analyzer output structs.
#[derive(Debug, Serialize)]
pub struct AnalyzeResponse {
    pub symbol:      String,
    pub analyzed_at: String,
    pub indicators:  Vec<String>,   // which indicators were run
    pub result:      Value,         // raw JSON from C++, passed through as-is
}

#[derive(Debug, Serialize)]
pub struct FetchResponse {
    pub fetched_at: String,
    pub symbols:    Vec<SymbolFetchResult>,
}

#[derive(Debug, Serialize)]
pub struct SymbolFetchResult {
    pub symbol:  String,
    pub success: bool,
    pub records: Option<i64>,
    pub error:   Option<String>,
}

#[derive(Debug, Serialize)]
pub struct IndicatorsResponse {
    pub available: Vec<String>,
    pub default:   Vec<String>,
}

// ── API errors ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub error:   String,
    pub message: String,
}

impl ApiError {
    pub fn not_found(symbol: &str) -> Self {
        Self {
            error:   "symbol_not_found".into(),
            message: format!("No data found for symbol {}", symbol),
        }
    }

    pub fn analyzer_failed(msg: &str) -> Self {
        Self {
            error:   "analyzer_failed".into(),
            message: msg.to_string(),
        }
    }

    pub fn querier_failed(msg: &str) -> Self {
        Self {
            error:   "querier_failed".into(),
            message: msg.to_string(),
        }
    }

    pub fn invalid_indicator(name: &str) -> Self {
        Self {
            error:   "invalid_indicator".into(),
            message: format!("Unknown indicator: {}", name),
        }
    }
}