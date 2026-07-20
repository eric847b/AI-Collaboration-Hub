#include "lock_manager.h"

namespace vectorfs {

std::mutex& LockManager::global() {
    return global_lock_;
}

}
