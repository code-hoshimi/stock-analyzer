FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY main.cpp indicators.cpp indicators.h analyzers.cpp analyzers.h ./
COPY sql/ sql/
COPY models/ models/
COPY utils/ utils/
RUN g++ -std=c++23 -O2 -o analyzer main.cpp indicators.cpp analyzers.cpp -lsqlite3


FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/analyzer .

ENV INTERVAL_SECONDS=60

CMD ["./analyzer"]
