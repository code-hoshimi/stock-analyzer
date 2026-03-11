#pragma once
#ifndef __THREAD_POOL_H__
#define __THREAD_POOL_H__

#include <thread>
#include <vector>
#include <queue>
#include <functional>
#include <mutex>
#include <condition_variable>
#include <future>
#include <iostream>

namespace hoshimi {

class ThreadPool {
    std::vector<std::thread> workers;
    std::queue<std::function<void()>> tasks;
    std::mutex mtx;
    std::condition_variable cv;
    bool should_exit = false;

public:
    ThreadPool(size_t num_workers) {
        for (size_t i = 0; i < num_workers; i++) {
            workers.emplace_back([this, i]() -> void {
                while(true) {
                    std::function<void()> task;
                    {
                        std::unique_lock<std::mutex> lock(mtx);
                        cv.wait(lock, [this]{
                            return should_exit || !tasks.empty(); // detect spurious wakeup
                        });
                        if (should_exit && tasks.empty()) return;
                        task = std::move(tasks.front());
                        tasks.pop();
                    }
                    task();
                }
            });
        }
    }

    // Disable copy and move — owning threads makes this non-transferable
    ThreadPool(const ThreadPool&)            = delete;
    ThreadPool& operator=(const ThreadPool&) = delete;
    ThreadPool(ThreadPool&&)                 = delete;
    ThreadPool& operator=(ThreadPool&&)      = delete;

    void enqueue(std::function<void()> task) {
        {
            std::lock_guard<std::mutex> lg(mtx);
            if (should_exit) {
                throw std::runtime_error("enqueued on a destroyed threadpool");
            }
            tasks.push(std::move(task));
        }
        cv.notify_one();
    }

    template<typename F, typename... Args>
    auto submit(F&& f, Args&&... args) -> std::future<std::invoke_result_t<F, Args...>> {
        using R = std::invoke_result_t<F, Args...>;

        auto task = std::make_shared<std::packaged_task<R()>>(
            [f = std::forward<F>(f), ...args = std::forward<Args>(args)]() mutable {
                return f(std::move(args)...);
            }
        );

        std::future<R> future = task->get_future();
        enqueue([task]() { (*task)(); });
        return future;
    }

    void shutdown() {
        std::cout << "thread pool shutting down...\n";
        {
            std::lock_guard<std::mutex> lg(mtx);
            should_exit = true;
        }
        cv.notify_all();
        for (std::thread& t : workers) {
            t.join();
        }
    }

    ~ThreadPool() {
        std::cout << "destroying thread pool...\n";
        if (!should_exit) {
            shutdown();
        }
    }
};

}

#endif