CXX      := g++
CXXFLAGS := -std=c++23 -O2 -Wall -Wextra
LDFLAGS    := -lsqlite3

# ── gRPC install location ─────────────────────────────────────────────────────
GRPC_INSTALL := $(HOME)/data/grpc

# ── gRPC & protobuf ───────────────────────────────────────────────────────────
# Use deferred (=) so pkg-config is only invoked when actually building/linking
GRPC_FLAGS = $(shell PKG_CONFIG_PATH=$(GRPC_INSTALL)/lib/pkgconfig pkg-config --define-variable=prefix=$(GRPC_INSTALL) --cflags grpc++ protobuf)
GRPC_LIBS  = -L$(GRPC_INSTALL)/lib \
             $(shell PKG_CONFIG_PATH=$(GRPC_INSTALL)/lib/pkgconfig pkg-config --define-variable=prefix=$(GRPC_INSTALL) --libs --static grpc++ protobuf) \
             -lpthread -ldl
PROTOC     := $(GRPC_INSTALL)/bin/protoc
GRPC_PLUGIN:= $(GRPC_INSTALL)/bin/grpc_cpp_plugin

# ── Directories ───────────────────────────────────────────────────────────────
ROOT_DIR   := $(abspath ../..)
BIN_DIR    := $(ROOT_DIR)/build
PROTO_DIR  := $(ROOT_DIR)/protobuf
INCLUDE_DIR := $(CURDIR)/src/include
GEN_DIR    := $(CURDIR)/generated

TARGET     := $(BIN_DIR)/analyzer_cpp

# ── Analyzer sources ──────────────────────────────────────────────────────────────
SRCS       := src/main.cpp src/indicator.cpp src/analyzer.cpp
HDRS       := $(wildcard src/include/*.h)

# ── Proto sources (auto-discover all .proto files) ────────────────────────────
PROTO_SRCS := $(wildcard $(PROTO_DIR)/*.proto)
PROTO_GEN  := $(patsubst $(PROTO_DIR)/%.proto, $(GEN_DIR)/%.pb.cc,      $(PROTO_SRCS)) \
              $(patsubst $(PROTO_DIR)/%.proto, $(GEN_DIR)/%.grpc.pb.cc, $(PROTO_SRCS))

.PHONY: all build clean clean-all run protobuf tidy

all: build

## Generate C++ from .proto files (run once; protos rarely change)
protobuf: $(PROTO_GEN)
$(GEN_DIR)/%.pb.cc $(GEN_DIR)/%.grpc.pb.cc: $(PROTO_DIR)/%.proto | $(GEN_DIR)
	$(PROTOC) \
		--cpp_out=$(GEN_DIR) \
		--grpc_out=$(GEN_DIR) \
		--plugin=protoc-gen-grpc=$(GRPC_PLUGIN) \
		-I$(PROTO_DIR) \
		$<

## Compile the analyzer binary to ../../build/analyzer_cpp
## Run 'make protobuf' first if generated files are missing
build: $(TARGET)
$(TARGET): $(SRCS) $(HDRS) $(PROTO_GEN)
	$(CXX) $(CXXFLAGS) $(GRPC_FLAGS) \
		-I$(INCLUDE_DIR) \
		-I$(GEN_DIR) \
		-o $@ \
		$(SRCS) $(PROTO_GEN) \
		$(LDFLAGS) $(GRPC_LIBS)

## Run the compiled binary (DB_PATH defaults to /data/stocks.db)
run: build
	DB_PATH=$${DB_PATH:-/data/stocks.db} $(TARGET)

## Remove compiled binary only (generated proto files are preserved)
clean:
	rm -f $(TARGET)

## Remove compiled binary AND generated proto files
clean-all: clean
	rm -rf $(GEN_DIR)

$(BIN_DIR) $(GEN_DIR):
	mkdir -p $@

## Run bear to generate compile_commands.json for clangd
tidy:
	bear -- make clean && bear -- make