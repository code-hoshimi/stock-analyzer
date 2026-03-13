#include <cstdlib>
#include <cstring>
#include <csignal>
#include <iostream>
#include <string>
#include <sqlite3.h>

#include "indicator.pb.h"
#include "models.h"
#include "drawer.h"
#include "indicator.h"
#include "analyzer.h"
#include "thread_pool.h"

#include <grpcpp/grpcpp.h>
#include "indicator.grpc.pb.h"

using grpc::Server;
using grpc::ServerBuilder;
using grpc::ServerContext;
using grpc::Status;
using grpc::StatusCode;

using indicator::Analyzer;
using indicator::CrossRequest;
using indicator::CrossResponse;

static grpc::Server* g_server = nullptr;
static std::atomic<bool> g_shutdown{false};

class AnalyzerServiceImpl final : public Analyzer::Service {

private:
    std::string db_path_;
    std::unique_ptr<hoshimi::ThreadPool> thread_pool_;

    struct Parameters {
        int64_t ma_short = 20;
        int64_t ma_long = 60;
        int64_t rsi_period = 14;
        int64_t obv_rising_window = 5;
        std::string observation_window = "2024-01-01";
    };

    std::vector<::AnalysisResult> AnalyzeCross(std::string symbol, const Parameters& param) {
        auto prices = query_prices(db_path_, symbol);
        if (prices.empty()) { std::cout << "No data yet.\n"; return {}; }

        auto crosses = detect_ma_cross(prices, static_cast<int>(param.ma_short), static_cast<int>(param.ma_long));
        auto rsi     = calculate_rsi(prices, static_cast<int>(param.rsi_period));
        auto obv     = calculate_obv(prices, static_cast<int>(param.obv_rising_window));
        auto results = analyze(crosses, rsi, obv, param.observation_window);
        return results;
    }

public:
    explicit AnalyzerServiceImpl(const std::string& db_path, std::unique_ptr<hoshimi::ThreadPool> tp)
        : db_path_(db_path), thread_pool_(std::move(tp)) {}

    Status Cross(ServerContext* ctx,
                 const CrossRequest* req,
                 CrossResponse* res) override
    {
        if (req->symbol().empty()) {
            return Status(StatusCode::INVALID_ARGUMENT, "At least one symbol is required");
        }

        if (req->ma_short() <= 0 || req->ma_long() <= 0) {
            return Status(StatusCode::INVALID_ARGUMENT, "ma_short and ma_long must be positive");
        }

        if (req->ma_short() >= req->ma_long()) {
            return Status(StatusCode::INVALID_ARGUMENT, "ma_short must be less than ma_long");
        }

        if (req->rsi_period() <= 0) {
            return Status(StatusCode::INVALID_ARGUMENT, "rsi_period must be grater than 0");
        }

        if (req->obv_rising_window() <= 0) {
            return Status(StatusCode::INVALID_ARGUMENT, "obv_rising_window must be grater than 0");
        }

        Parameters param{
            .ma_short = req->ma_short(),
            .ma_long = req->ma_long(),
            .rsi_period = req->rsi_period(),
            .obv_rising_window = req->obv_rising_window(),
        };

        if (req->observation_window() != "") {
            param.observation_window = req->observation_window();
        }

        try {
            // Collect symbols from request
            std::vector<std::string> symbols(
                req->symbol().begin(),
                req->symbol().end()
            );

            std::vector<std::pair<std::string, std::future<std::vector<::AnalysisResult>>>> futures;
            futures.reserve(symbols.size());

            for (const auto& symbol : symbols) {
                futures.push_back({symbol, thread_pool_->submit([this, symbol, param]() {
                    return this->AnalyzeCross(symbol, param);
                })});
            }

            // Block until all workers are complete
            for (auto& f : futures) {
                auto results = f.second.get();
                auto* analysis_result = res->add_analysis_result();
                analysis_result->set_symbol(f.first);

                if (results.empty()) {
                    continue;
                }

                for (auto &r : results) {
                    *analysis_result->add_cross() = to_proto_cross_signal(r);
                }
            }

            return Status::OK;

        } catch (const std::exception& e) {
            return Status(StatusCode::INTERNAL, e.what());
        }
    }
};

int main() {
    const char* db_path_env = std::getenv("DB_PATH");
    std::string db_path = db_path_env ? db_path_env : "/data/stocks.db";

    const char* local_exec_env = std::getenv("LOCAL_EXEC");
    bool local_exec = local_exec_env != nullptr && std::string(local_exec_env) != "0";

    std::cout << "C++ analyzer starting — db=" << db_path << "\n";

    if (local_exec) {
        const char* symbol_env = std::getenv("SYMBOL");
        std::string symbol = symbol_env ? symbol_env : "0700.HK";

        const char* json_env = std::getenv("OUTPUT_JSON");
        bool output_json = json_env != nullptr && std::string(json_env) != "0";

        auto prices = query_prices(db_path, symbol);
        if (prices.empty()) { std::cout << "No data yet.\n"; return 0; }

        // TODO: parameterize this
        std::string cutoff = "2024-01-01";

        auto crosses = detect_ma_cross(prices);
        auto rsi     = calculate_rsi(prices);
        auto obv     = calculate_obv(prices);
        auto results = analyze(crosses, rsi, obv, cutoff);

        if (output_json) {
            print_results_json(results, crosses, symbol, true);
        } else {
            print_results(results, crosses, symbol, true);
        }
        return 0;
    }

    const char* port_env = std::getenv("GRPC_PORT");
    std::string port = port_env ? port_env : "50051";
    std::string address = "0.0.0.0:" + port;

    AnalyzerServiceImpl service(db_path, std::make_unique<hoshimi::ThreadPool>(10));

    ServerBuilder builder;
    builder.AddListeningPort(address, grpc::InsecureServerCredentials());
    builder.RegisterService(&service);

    std::unique_ptr<Server> server = builder.BuildAndStart();

    if (!server) {
        std::cerr << "Failed to start server on " << address << std::endl;
        return 1;
    }

    g_server = server.get();
    std::signal(SIGINT,  [](int) { g_shutdown.store(true); });
    std::signal(SIGTERM, [](int) { g_shutdown.store(true); });

    std::cout << "Analyzer gRPC server listening on " << address << std::endl;
    std::cout << "DB_PATH: " << db_path << std::endl;

    while (!g_shutdown.load()) {
        std::this_thread::sleep_for(std::chrono::milliseconds(1000));
    }
    server->Shutdown();
    return 0;
}

