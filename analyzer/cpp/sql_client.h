#include <cstdlib>
#include <cstring>
#include <iostream>
#include <iomanip>
#include <string>
#include <vector>
#include <sstream>
#include <sqlite3.h>

namespace hoshimi {
    namespace sql_client {

template<typename T>
T defaultParser(sqlite3_stmt* stmt) {
    const char* str = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
    std::istringstream ss(str);
    T value;
    if (!(ss >> value)) throw std::runtime_error(std::string("Parse failed: ") + str);
    return value;
}

template<typename T, typename Parser = T(*)(const char*)>
void query(const std::string& db_path, const std::string& query_str, std::vector<T>& output, Parser parser = defaultParser<T>) {
    sqlite3* db = nullptr;
    if (sqlite3_open(db_path.c_str(), &db) != SQLITE_OK) {
        std::cerr << "Cannot open database: " << sqlite3_errmsg(db) << "\n";
        return;
    }

    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db, query_str.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
        std::cerr << "Failed to prepare statement: " << sqlite3_errmsg(db) << "\n";
        sqlite3_close(db);
        return;
    }

    while (sqlite3_step(stmt) == SQLITE_ROW) {
        output.push_back(parser(stmt));
    }
    sqlite3_finalize(stmt);
    sqlite3_close(db);
}
}
}