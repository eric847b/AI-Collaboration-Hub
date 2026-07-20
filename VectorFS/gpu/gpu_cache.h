#pragma once
#include <cstddef>
#include <unordered_map>
#include <list>
#include <cstdint>
#include <vector>

namespace vectorfs {

using GPUId = uint32_t;
using BlockId = uint64_t;

struct GPUBlock {
    BlockId id;
    std::vector<uint8_t> data;
    void* device_ptr = nullptr;  // CUDA/Vulkan buffer pointer (nullptr if CPU-only)
};

class GPUCache {
    struct Entry {
        GPUBlock block;
        GPUId gpu;
    };

    size_t capacity_;
    std::list<Entry> lru_;
    std::unordered_map<BlockId, decltype(lru_.begin())> index_;

    void touch(decltype(lru_.begin()) it);

public:
    explicit GPUCache(size_t capacity);

    bool put(GPUId gpu, const GPUBlock& block);
    GPUBlock* get(BlockId id);
    void clear();
};

} // namespace vectorfs