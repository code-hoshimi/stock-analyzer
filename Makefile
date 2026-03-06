.PHONY: docker-build build-analyzer-cpp run-analyzer-api-server

## Build all images
docker-build:
	docker compose build

## Compile the C++ analyzer binary locally at bin/analyzer_cpp
build-analyzer-cpp:
	$(MAKE) -C analyzer/cpp build

## Build the analyzer apiserver Docker image and run it
run-analyzer-api-server:
	docker compose build apiserver
	docker compose run --rm -d -p 3881:3881 apiserver

## Run the UI API Gateway
run-ui-api-gateway:
	DB_PATH=$${DB_PATH:-/data/stocks.db} \
	PORT=$${PORT:-8080} \
	DATA_SERVER_BASE=$${DATA_SERVER_BASE:-http://localhost:3881} \
	docker compose up --build ui_api_gateway
