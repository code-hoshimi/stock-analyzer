.PHONY: docker-build build-querier run-querier build-analyzer-cpp run-analyzer-cpp

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

## Compile the C++ analyzer binary locally at bin/analyzer_cpp
build-analyzer-cpp:
	mkdir -p bin
	g++ -std=c++17 -O2 -o bin/analyzer_cpp analyzer/cpp/main.cpp -lsqlite3

## Build the C++ analyzer Docker image and run it
run-analyzer-cpp:
	docker compose build analyzer_cpp
	docker compose run --rm \
		-e DB_PATH=$${DB_PATH:-/data/stocks.db} \
		analyzer_cpp