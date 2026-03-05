mod models;
mod routes;

use axum::{
    routing::{get, post},
    Router,
};
use std::env;
use tracing::info;
use tracing_subscriber::EnvFilter;

#[derive(Clone)]
pub struct AppState {
    pub db_path:       String,
    pub querier_path:  String,
    pub analyzer_path: String,
    pub symbols:       Vec<String>,
}

const DEFAULT_SYMBOLS: &[&str] = &[
    "0700.HK", "9988.HK", "3690.HK", "9999.HK", "1810.HK",
    "9618.HK", "0241.HK", "2382.HK", "0992.HK", "6690.HK",
];

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("api_server=info".parse().unwrap()),
        )
        .init();

    let db_path = env::var("DB_PATH")
        .unwrap_or_else(|_| "/mnt/hoshimi/data/stock_data/stocks.db".to_string());
    let querier_path = env::var("QUERIER_PATH")
        .unwrap_or_else(|_| "/home/hoshimi/workspace/stock-analyzer/yfinance_querier/main.py".to_string());
    let analyzer_path = env::var("ANALYZER_PATH")
        .unwrap_or_else(|_| "/home/hoshimi/workspace/stock-analyzer/bin/analyzer_cpp".to_string());
    let symbols = env::var("SYMBOLS")
        .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
        .unwrap_or_else(|_| DEFAULT_SYMBOLS.iter().map(|s| s.to_string()).collect());
    let port = env::var("PORT").unwrap_or_else(|_| "3881".to_string());
    let addr = format!("0.0.0.0:{}", port);

    let state = AppState { db_path, querier_path, analyzer_path, symbols };

    info!("Starting api-server on {}", addr);

    let app = Router::new()
        .route("/fetch",                post(routes::fetch::fetch_handler))
        .route("/analyze/:symbol",      get(routes::analyze::analyze_handler))
        .route("/indicators",           get(routes::analyze::indicators_handler))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}