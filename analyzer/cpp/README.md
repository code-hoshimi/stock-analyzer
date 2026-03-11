# analyzer_cpp

C++ stock analyzer. Reads price data from a SQLite database and detects MA cross signals enriched with RSI and OBV. Can run as a **gRPC server** or as a **one-shot CLI tool**.

## Prerequisites

- gRPC + protobuf installed at `~/data/grpc` (used by the Makefile)
- `libsqlite3-dev` (build) / `libsqlite3-0` (runtime)

## Build

Proto files only need generating once (or when `indicator.proto` changes):

```sh
# From analyzer/cpp/
make protobuf   # generates generated/indicator.pb.cc etc.
make build      # compiles → ../../build/analyzer_cpp
```

Clean targets:

```sh
make clean      # removes the binary, keeps generated/ intact
make clean_all  # removes binary + generated/
```

## Running

### gRPC server (default)

Listens on `0.0.0.0:<GRPC_PORT>` and serves the `Analyzer` service defined in `indicator.proto`.

```sh
DB_PATH=/path/to/stocks.db ./build/analyzer_cpp
```

| Env var     | Default          | Description                  |
|-------------|------------------|------------------------------|
| `DB_PATH`   | `/data/stocks.db`| Path to the SQLite database  |
| `GRPC_PORT` | `50051`          | Port the gRPC server listens on |

### Local / one-shot CLI

Set `LOCAL_EXEC=1` to skip the server and print results for a single symbol directly to stdout.

```sh
DB_PATH=/path/to/stocks.db \
SYMBOL=0241.HK \
LOCAL_EXEC=1 \
OUTPUT_JSON=1 \
./build/analyzer_cpp
```

| Env var       | Default      | Description                              |
|---------------|--------------|------------------------------------------|
| `DB_PATH`     | `/data/stocks.db` | Path to the SQLite database         |
| `LOCAL_EXEC`  | _(unset)_    | Set to `1` to enable one-shot CLI mode   |
| `SYMBOL`      | `0700.HK`    | Ticker symbol to analyze                 |
| `OUTPUT_JSON` | _(unset)_    | Set to `1` to print results as JSON      |

### Docker

Build the image (from repo root):

```sh
docker build \
  --build-context grpc=/home/hoshimi/data/grpc \
  -f analyzer/cpp/Dockerfile \
  -t analyzer-cpp .
```

Run:

```sh
docker run --rm \
  -e DB_PATH=/data/stocks.db \
  -v /path/to/stock_data:/data \
  -p 3881:3881 \
  analyzer-cpp
```

### Docker Compose

The `analyzer` service is defined in `docker-compose.yml` at the repo root:

```sh
# From repo root
docker compose up analyzer

# Or via the root Makefile
make run-analyzer-cpp
```

## gRPC API

Defined in `../../protobuf/indicator.proto`.

### `Analyzer.Cross`

Analyzes one or more symbols for MA crossover signals.

**Request** (`CrossRequest`):

| Field      | Type              | Description                        |
|------------|-------------------|------------------------------------|
| `symbol`   | `repeated string` | One or more ticker symbols         |
| `ma_short` | `int64`           | Short MA window (must be < ma_long)|
| `ma_long`  | `int64`           | Long MA window                     |

**Response** (`CrossResponse`): a list of `AnalysisResult`, one per symbol, each containing a list of `CrossSignal` with datetime, cross type (golden/death), MA values, RSI, OBV, and a buy-signal flag.

## Project layout

```
analyzer/cpp/
├── src/
│   ├── main.cpp          # gRPC server + LOCAL_EXEC entry point
│   ├── analyzer.cpp      # core analysis logic
│   ├── indicator.cpp     # MA cross detection, RSI, OBV
│   └── include/
│       ├── analyzer.h
│       ├── indicator.h
│       ├── models.h      # Price structs + query_prices()
│       ├── sql_client.h
│       ├── drawer.h
│       └── thread_pool.h
├── generated/        # protobuf-generated files (not committed)
├── Makefile
└── Dockerfile
```
