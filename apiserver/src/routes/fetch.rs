use axum::{extract::State, http::StatusCode, Json};
use chrono::Local;
use std::process::Command;
use tracing::{error, info};

use crate::{
    models::{ApiError, FetchResponse, SymbolFetchResult},
    AppState,
};

// POST /fetch
// Runs the Python querier for all configured symbols.
pub async fn fetch_handler(
    State(state): State<AppState>,
) -> Result<Json<FetchResponse>, (StatusCode, Json<ApiError>)> {
    info!("POST /fetch — running querier for {} symbols", state.symbols.len());

    let mut results = Vec::new();

    for symbol in &state.symbols {
        let result = run_querier(&state.querier_path, &state.db_path, symbol);
        results.push(result);
    }

    Ok(Json(FetchResponse {
        fetched_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        symbols:    results,
    }))
}

fn run_querier(querier_path: &str, db_path: &str, symbol: &str) -> SymbolFetchResult {
    info!("Running querier for {}", symbol);

    let output = Command::new("python3")
        .arg(querier_path)
        .env("DB_PATH",  db_path)
        .env("SYMBOLS",  symbol)
        .env("INTERVAL", "1d")
        .env("PERIOD",   "6mo")
        .output();

    match output {
        Err(e) => {
            error!("Failed to spawn querier for {}: {}", symbol, e);
            SymbolFetchResult {
                symbol:  symbol.to_string(),
                success: false,
                records: None,
                error:   Some(format!("Failed to spawn process: {}", e)),
            }
        }
        Ok(out) => {
            if out.status.success() {
                // Parse record count from querier stdout
                // querier.py logs: "Stored N records for SYMBOL into PATH"
                let stdout = String::from_utf8_lossy(&out.stdout);
                let records = parse_record_count(&stdout, symbol);

                info!("Querier succeeded for {} ({:?} records)", symbol, records);
                SymbolFetchResult {
                    symbol:  symbol.to_string(),
                    success: true,
                    records,
                    error:   None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                error!("Querier failed for {}: {}", symbol, stderr);
                SymbolFetchResult {
                    symbol:  symbol.to_string(),
                    success: false,
                    records: None,
                    error:   Some(stderr),
                }
            }
        }
    }
}

// Parse "Stored 121 records for 0700.HK into /data/stocks.db" from querier log
fn parse_record_count(stdout: &str, symbol: &str) -> Option<i64> {
    for line in stdout.lines() {
        if line.contains("Stored") && line.contains(symbol) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if let Some(pos) = parts.iter().position(|&w| w == "Stored") {
                if let Some(n) = parts.get(pos + 1) {
                    return n.parse().ok();
                }
            }
        }
    }
    None
}