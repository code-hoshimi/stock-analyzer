.PHONY: docker-build build-analyzer run-analyzer run-ui-api-gateway

## Build all images
docker-build:
	docker compose build

## Compile the C++ analyzer binary locally
build-analyzer:
	$(MAKE) -C analyzer/cpp build

## Build the analyzer Docker image and run it
run-analyzer:
	docker compose up -d --build analyzer

## Run the UI API Gateway
run-ui-api-gateway:
	DB_PATH=$${DB_PATH:-/data/stocks.db} \
	PORT=$${PORT:-8080} \
	DATA_SERVER_BASE=$${DATA_SERVER_BASE:-http://localhost:3881} \
	docker compose up --build ui_api_gateway
