CXX      := g++
CXXFLAGS := -std=c++23 -O2 -Wall -Wextra
LDFLAGS  := -lsqlite3

BIN_DIR  := ../../bin
TARGET   := $(BIN_DIR)/analyzer_cpp

SRCS     := main.cpp indicators.cpp analyzers.cpp
HDRS     := indicators.h analyzers.h $(wildcard sql/*.h models/*.h utils/*.h)

.PHONY: all build clean run

all: build

## Compile the analyzer binary to ../../bin/analyzer_cpp
build: $(TARGET)

$(TARGET): $(SRCS) $(HDRS)
	mkdir -p $(BIN_DIR)
	$(CXX) $(CXXFLAGS) -o $@ $(SRCS) $(LDFLAGS)

## Run the compiled binary (DB_PATH defaults to /data/stocks.db)
run: build
	DB_PATH=$${DB_PATH:-/data/stocks.db} $(TARGET)

## Remove the compiled binary
clean:
	rm -f $(TARGET)
