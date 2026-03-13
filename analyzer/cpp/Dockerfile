# syntax=docker/dockerfile:1
# ── Stage 1: Build ────────────────────────────────────────────────────────────
# The host gRPC installation is bind-mounted at build time (not baked in).
# Build with:
#   docker build \
#     --build-context grpc=/home/hoshimi/data/grpc \
#     -f analyzer/cpp/Dockerfile \
#     -t analyzer-cpp .
FROM ubuntu:24.04 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        pkg-config \
        libsqlite3-dev \
        libssl-dev \
        libre2-dev \
        zlib1g-dev \
        make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
COPY . .

RUN --mount=type=bind,from=grpc,target=/root/data/grpc \
    cd analyzer/cpp && make protobuf && make build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
        libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /workspace/build/analyzer_cpp .

ENV DB_PATH=/data/stocks.db
ENV GRPC_PORT=3881
EXPOSE 3881

CMD ["./analyzer_cpp"]