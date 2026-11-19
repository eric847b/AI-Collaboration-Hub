#pragma once

#include "cas/cas.h"
#include <algorithm>
#include <chrono>
#include <limits>
#include <mutex>
#include <vector>

struct CacheLine {
    Hash key;
    std::vector<unsigned char> value;
    std::chrono::steady_clock::time_point timestamp;
};

class GpuCacheAccelerator {
public:
    explicit GpuCacheAccelerator(CAS* cas, size_t gpu_ram_mb = 1024)
        : cas_(cas),
          gpu_ram_bytes_(gpu_ram_mb > std::numeric_limits<size_t>::max() / (1024 * 1024)
              ? std::numeric_limits<size_t>::max()
              : gpu_ram_mb * 1024 * 1024) {}

    bool accelerate_read(const Hash& key, std::vector<unsigned char>& data) {
        std::lock_guard<std::mutex> lock(cache_mutex_);
        auto cached = find(key);
        if (cached != cache_.end()) {
            cached->timestamp = std::chrono::steady_clock::now();
            data = cached->value;
            return true;
        }

        if (!cas_ || !cas_->contains(key)) return false;
        data = cas_->get(key).data;
        store_in_gpu(key, data);
        return true;
    }

    bool accelerate_write(const Hash& key, const std::vector<unsigned char>& data) {
        if (!cas_) return false;

        Node node = Node::file();
        node.data = data;
        if (cas_->hash_node(node) != key || cas_->put(node) != key) return false;

        std::lock_guard<std::mutex> lock(cache_mutex_);
        store_in_gpu(key, data);
        return true;
    }

    bool accelerate_write(const std::vector<unsigned char>& data, Hash& key) {
        if (!cas_) return false;

        Node node = Node::file();
        node.data = data;
        key = cas_->hash_node(node);
        return accelerate_write(key, data);
    }

    void gc_cache(std::chrono::minutes max_age = std::chrono::minutes(30)) {
        std::lock_guard<std::mutex> lock(cache_mutex_);
        const auto now = std::chrono::steady_clock::now();
        for (auto line = cache_.begin(); line != cache_.end();) {
            if (now - line->timestamp > max_age) {
                cache_used_bytes_ -= line->value.size();
                line = cache_.erase(line);
            } else {
                ++line;
            }
        }
    }

    size_t cache_size() const {
        std::lock_guard<std::mutex> lock(cache_mutex_);
        return cache_.size();
    }

    size_t gpu_ram_used() const {
        std::lock_guard<std::mutex> lock(cache_mutex_);
        return cache_used_bytes_;
    }

    bool is_in_gpu_cache(const Hash& key) const {
        std::lock_guard<std::mutex> lock(cache_mutex_);
        return find(key) != cache_.end();
    }

    void evict_lru() {
        std::lock_guard<std::mutex> lock(cache_mutex_);
        evict_lru_locked();
    }

private:
    CAS* cas_;
    size_t gpu_ram_bytes_;
    size_t cache_used_bytes_ = 0;
    std::vector<CacheLine> cache_;
    mutable std::mutex cache_mutex_;

    std::vector<CacheLine>::iterator find(const Hash& key) {
        return std::find_if(cache_.begin(), cache_.end(),
            [&](const CacheLine& line) { return line.key == key; });
    }

    std::vector<CacheLine>::const_iterator find(const Hash& key) const {
        return std::find_if(cache_.begin(), cache_.end(),
            [&](const CacheLine& line) { return line.key == key; });
    }

    void store_in_gpu(const Hash& key, const std::vector<unsigned char>& data) {
        if (data.size() > gpu_ram_bytes_) return;

        auto existing = find(key);
        if (existing != cache_.end()) {
            cache_used_bytes_ -= existing->value.size();
            cache_.erase(existing);
        }

        while (cache_used_bytes_ > gpu_ram_bytes_ - data.size()) {
            evict_lru_locked();
        }

        cache_.push_back({key, data, std::chrono::steady_clock::now()});
        cache_used_bytes_ += data.size();
    }

    void evict_lru_locked() {
        if (cache_.empty()) return;

        const auto oldest = std::min_element(cache_.begin(), cache_.end(),
            [](const CacheLine& left, const CacheLine& right) {
                return left.timestamp < right.timestamp;
            });
        cache_used_bytes_ -= oldest->value.size();
        cache_.erase(oldest);
    }
};

struct CacheJournalEntry {
    Hash data_hash;
    bool gpu_cached = false;
    std::chrono::steady_clock::time_point created;
    size_t compressed_size = 0;
};

inline CacheJournalEntry write_cached_journal(const std::vector<unsigned char>& data,
                                               GpuCacheAccelerator* accelerator) {
    CacheJournalEntry entry;
    entry.created = std::chrono::steady_clock::now();
    entry.compressed_size = data.size();
    if (accelerator) {
        const bool persisted = accelerator->accelerate_write(data, entry.data_hash);
        entry.gpu_cached = persisted && accelerator->is_in_gpu_cache(entry.data_hash);
    }
    return entry;
}
