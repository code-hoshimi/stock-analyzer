use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::Local;
use rusqlite::Connection;
use serde::Deserialize;
use std::process::Command;
use tracing::{error, info};

use crate::{
    models::{AnalyzeResponse, ApiError, IndicatorsResponse},
    AppState,
};

// All known indicators — single source of truth on the Rust side.
// Only used for validation. C++ defines actual behavior.
const KNOWN_INDICATORS: &[&str] = &["ma_cross", "rsi", "obv"];

#[derive(Debug, Deserialize)]
pub struct AnalyzeParams {
    pub indicators: Option<String>,  // e.g. "ma_cross,rsi"
    pub verbose:    Option<bool>,
    pub cutoff:     Option<String>,  // YYYY-MM-DD
}

// GET /indicators
pub async fn indicators_handler(
    State(state): State<AppState>,
) -> Json<IndicatorsResponse> {
    // Ask C++ for its list of available indicators
    // Falls back to KNOWN_INDICATORS if the process fails
    let available = fetch_indicators_from_cpp(&state.analyzer_path)
        .unwrap_or_else(|| KNOWN_INDICATORS.iter().map(|s| s.to_string()).collect());

    Json(IndicatorsResponse {
        default:   available.clone(),
        available,
    })
}

// GET /analyze/{symbol}?indicators=ma_cross,rsi&verbose=true&cutoff=2026-02-01
pub async fn analyze_handler(
    Path(symbol): Path<String>,
    Query(params): Query<AnalyzeParams>,
    State(state): State<AppState>,
) -> Result<Json<AnalyzeResponse>, (StatusCode, Json<ApiError>)> {
    // Parse and validate requested indicators
    let indicators = parse_indicators(&params.indicators);
    for ind in &indicators {
        if !KNOWN_INDICATORS.contains(&ind.as_str()) {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ApiError::invalid_indicator(ind)),
            ));
        }
    }

    info!(
        "GET /analyze/{} indicators={:?} verbose={:?}",
        symbol, indicators, params.verbose
    );

    // Check symbol exists in DB
    if !symbol_exists(&state.db_path, &symbol) {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiError::not_found(&symbol)),
        ));
    }

    // Default cutoff: 30 days ago
    let cutoff = params.cutoff.unwrap_or_else(|| {
        (Local::now() - chrono::Duration::days(120))
            .format("%Y-%m-%d")
            .to_string()
    });

    let verbose = params.verbose.unwrap_or(false);

    // Run C++ analyzer, get raw JSON back
    let raw_json = run_analyzer(
        &state.analyzer_path,
        &state.db_path,
        &symbol,
        &cutoff,
        &indicators,
        verbose,
    )
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::analyzer_failed(&e)),
            )
        })?;

    Ok(Json(AnalyzeResponse {
        symbol,
        analyzed_at: Local::now().format("%Y-%m-%d").to_string(),
        indicators,
        result: raw_json,   // transparent passthrough, Rust never inspects this
    }))
}

// ── Helpers ───────────────────────────────────────────────────────────────

fn parse_indicators(param: &Option<String>) -> Vec<String> {
    match param {
        None => KNOWN_INDICATORS.iter().map(|s| s.to_string()).collect(),
        Some(s) => s
            .split(',')
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty())
            .collect(),
    }
}

fn run_analyzer(
    analyzer_path: &str,
    db_path: &str,
    symbol: &str,
    cutoff: &str,
    indicators: &[String],
    verbose: bool,
) -> Result<serde_json::Value, String> {
    let output = Command::new(analyzer_path)
        .env("DB_PATH",     db_path)
        .env("SYMBOL",      symbol)
        .env("CUTOFF_DATE", cutoff)
        .env("INDICATORS",  indicators.join(","))
        .env("OUTPUT_JSON", "1")
        .env("VERBOSE",     if verbose { "1" } else { "0" })
        .output()
        .map_err(|e| format!("Failed to spawn analyzer: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        error!("Analyzer failed for {}: {}", symbol, stderr);
        return Err(format!("Analyzer exited with error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse analyzer JSON: {}\nRaw: {}", e, stdout))
}

fn fetch_indicators_from_cpp(analyzer_path: &str) -> Option<Vec<String>> {
    let output = Command::new(analyzer_path)
        .env("LIST_INDICATORS", "1")
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let json: serde_json::Value =
        serde_json::from_slice(&output.stdout).ok()?;

    let available = json["available"]
        .as_array()?
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    Some(available)
}

fn symbol_exists(db_path: &str, symbol: &str) -> bool {
    let Ok(conn) = Connection::open(db_path) else {
        return false;
    };
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM stock_prices WHERE symbol = ?1 LIMIT 1",
            [symbol],
            |row| row.get(0),
        )
        .unwrap_or(0);
    count > 0
}