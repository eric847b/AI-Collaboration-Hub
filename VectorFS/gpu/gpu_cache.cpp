#include "gpu_cache.h"

namespace vectorfs {

GPUCache::GPUCache(size_t capacity)
    : capacity_(capacity) {}

void GPUCache::touch(decltype(lru_.begin()) it) {
    lru_.splice(lru_.begin(), lru_, it);
}

bool GPUCache::put(GPUId gpu, const GPUBlock& block) {
    auto it = index_.find(block.id);

    if (it != index_.end()) {
        it->second->block = block;
        it->second->gpu = gpu;
        touch(it->second);
        return true;
    }

    if (lru_.size() >= capacity_) {
        auto last = lru_.back();
        index_.erase(last.block.id);
        lru_.pop_back();
    }

    lru_.push_front({block, gpu});
    index_[block.id] = lru_.begin();

    return true;
}

GPUBlock* GPUCache::get(BlockId id) {
    auto it = index_.find(id);
    if (it == index_.end()) return nullptr;

    touch(it->second);
    return &it->second->block;
}

void GPUCache::clear() {
    lru_.clear();
    index_.clear();
}

} // namespace vectorfs