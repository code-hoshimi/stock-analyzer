# ── Stage 1: Build C++ analyzer ──────────────────────────────────────────────
FROM debian:bookworm-slim AS cpp-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        g++ libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY analyzer/cpp/main.cpp analyzer/cpp/indicators.cpp analyzer/cpp/indicators.h \
     analyzer/cpp/analyzers.cpp analyzer/cpp/analyzers.h ./
COPY analyzer/cpp/sql/    sql/
COPY analyzer/cpp/models/ models/
COPY analyzer/cpp/utils/  utils/

RUN g++ -std=c++23 -O2 -o analyzer_cpp main.cpp indicators.cpp analyzers.cpp -lsqlite3

# ── Stage 2: Build Rust api-server ───────────────────────────────────────────
FROM rust:1-bookworm AS rust-builder

WORKDIR /build

# Cache dependency compilation separately from source changes
COPY apiserver/Cargo.toml apiserver/Cargo.lock ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs && \
    cargo build --release && \
    rm -rf src

COPY apiserver/src ./src
# Touch main.rs so cargo detects the source has changed
RUN touch src/main.rs && cargo build --release

# ── Final stage ───────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        libsqlite3-0 \
        python3 \
        python3-pip \
        ca-certificates && \
    pip3 install --no-cache-dir --break-system-packages yfinance && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=cpp-builder  /build/analyzer_cpp        ./analyzer_cpp
COPY --from=rust-builder /build/target/release/api-server ./api-server
COPY yfinance_querier/main.py                        ./querier/querier.py

ENV DB_PATH=/data/stocks.db
ENV QUERIER_PATH=/app/querier/querier.py
ENV ANALYZER_PATH=/app/analyzer_cpp
ENV PORT=3881

EXPOSE 3881

CMD ["/app/api-server"]
