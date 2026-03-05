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