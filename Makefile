.PHONY: docker-build build-querier run-querier run-yfinance-querier build-analyzer-cpp run-analyzer-cpp

## Build all images
docker-build:
	docker compose build

## Build a native querier binary at bin/querier
build-querier:
	mkdir -p bin
	cd querier && CGO_ENABLED=1 go build -o ../bin/querier .

## Run the querier once to fetch and store stock data
run-querier:
	docker compose run --rm \
		-e DB_PATH=$${DB_PATH:-/data/stocks.db} \
		-e TWELVEDATA_API_KEY=$${TWELVEDATA_API_KEY} \
		querier

## Build the yfinance querier image and run it once
run-yfinance-querier:
	docker compose build querier_python
	docker compose run --rm \
		-e DB_PATH=$${DB_PATH:-/data/stocks.db} \
		-e SYMBOLS=$${SYMBOLS:-} \
		-e INTERVAL=$${INTERVAL:-1d} \
		-e PERIOD=$${PERIOD:-6mo} \
		querier_python

## Compile the C++ analyzer binary locally at bin/analyzer_cpp
build-analyzer-cpp:
	$(MAKE) -C analyzer/cpp build

## Build the C++ analyzer Docker image and run it
run-analyzer-cpp:
	docker compose build analyzer_cpp
	docker compose run --rm \
		-e DB_PATH=$${DB_PATH:-/data/stocks.db} \
		analyzer_cpp

## Run the UI API Gateway
run-ui-api-gateway:
	docker compose run --rm \
		-e DB_PATH=$${DB_PATH:-/data/stocks.db} \
		-e PORT=$${PORT:-8080} \
		-e DATA_SERVER_BASE=$${DATA_SERVER_BASE:-http://localhost:3881} \
		ui_api_gateway