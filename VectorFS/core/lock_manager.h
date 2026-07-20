#pragma once
#include <mutex>

namespace vectorfs {

class LockManager {
public:
    std::mutex& global();

private:
    std::mutex global_lock_;
};

}
