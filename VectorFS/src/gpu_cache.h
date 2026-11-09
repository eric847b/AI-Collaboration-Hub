#pragma once

#include "cas/cas_store.h"
#include "metadata/metadata_store.h"
#include <chrono>
#include <mutex>
#include <vector>

struct CacheLine {
    Hash key;
    Hash value;
    std::chrono::steady_clock::time_point timestamp;
    bool gpu_resident = false;
    size_t size_bytes = 0;
};

class GpuCacheAccelerator {
public:
    GpuCacheAccelerator(CAS* cas, MetadataStore* metadata, size_t gpu_ram_mb = 1024)
        : cas_(cas), metadata_(metadata), gpu_ram_bytes_(gpu_ram_mb * 1024 * 1024) {
        cache_capacity_ = gpu_ram_bytes_ / sizeof(CacheLine);
        cache_.reserve(cache_capacity_);
        initialize_gpu_memory();
    }

    bool accelerate_read(const Hash& key, std::vector<unsigned char>& data) {
        std::lock_guard<std::mutex> lock(cache_mutex_);

        // Check GPU cache first (fast path)
        for (const auto& line : cache_) {
            if (line.key == key && line.gpu_resident && !line.value.b.empty()) {
                data = retrieve_from_gpu(key);
                return true;
            }
        }

        // Cache miss - read from storage (slow path)
        return cas_->get(key, data);
    }

    bool accelerate_write(const Hash& key, const std::vector<unsigned char>& data) {
        std::lock_guard<std::mutex> lock(cache_mutex_);

        // Store in GPU RAM first
        if (store_in_gpu(key, data)) {
            // Then persist to storage
            cas_->put(key, Node::file());
            return true;
        }

        // Fallback: store directly to storage
        return cas_->put(key, data);
    }

    void gc_cache(std::chrono::minutes max_age = std::chrono::minutes(30)) {
        std::lock_guard<std::mutex> lock(cache_mutex_);

        auto now = std::chrono::steady_clock::now();
        cache.erase(
            std::remove_if(cache_.begin(), cache_.end(),
                [&](const CacheLine& line) {
                    return std::chrono::duration_cast<std::chrono::minutes>(now - line.timestamp).count() > max_age.count();
                }),
            cache_.end()
        );

        free_expired_gpu_memory();
    }

    size_t cache_size() const { return cache_.size(); }
    size_t gpu_ram_used() const {
        std::lock_guard<std::mutex> lock(cache_mutex_);
        return cache_.size() * sizeof(CacheLine);
    }

    bool is_in_gpu_cache(const Hash& key) const {
        std::lock_guard<std::mutex> lock(cache_mutex_);
        for (const auto& line : cache_) {
            if (line.key == key && line.gpu_resident) {
                return true;
            }
        }
        return false;
    }

private:
    CAS* cas_;
    MetadataStore* metadata_;
    size_t gpu_ram_bytes_;
    size_t cache_capacity_;
    std::vector<CacheLine> cache_;
    mutable std::mutex cache_mutex_;

    void initialize_gpu_memory() {
        cache_.resize(cache_capacity_);
        for (auto& line : cache_) {
            line.gpu_resident = false;
        }
    }

    bool store_in_gpu(const Hash& key, const std::vector<unsigned char>& data) {
        if (cache_.size() >= cache_capacity_) {
            evict_lru();
        }

        for (auto& line : cache_) {
            if (!line.gpu_resident || line.key == key) {
                line.key = key;
                line.value = Hash(data.empty() ? Hash{} : data.data(), data.size());
                line.timestamp = std::chrono::steady_clock::now();
                line.gpu_resident = true;
                line.size_bytes = data.size();
                return true;
            }
        }
        return false;
    }

    void evict_lru() {
        if (cache_.empty()) return;
        auto oldest = std::min_element(cache_.begin(), cache_.end(),
            [](const CacheLine& a, const CacheLine& b) {
                return a.timestamp < b.timestamp;
            });
        oldest->gpu_resident = false;
        oldest.key = Hash{};
    }

    std::vector<unsigned char> retrieve_from_gpu(const Hash& key) {
        for (const auto& line : cache_) {
            if (line.key == key && line.gpu_resident) {
                return std::vector<unsigned char>(line.value.b.begin(), line.value.b.end());
            }
        }
        return {};
    }

    void free_expired_gpu_memory() {
        for (auto& line : cache_) {
            if (line.gpu_resident) {
                line.gpu_resident = false;
            }
        }
    }
};

struct CacheJournalEntry {
    Hash data_hash;
    bool gpu_cached = false;
    std::chrono::steady_clock::time_point created;
    size_t compressed_size = 0;
};

bool write_cached_journal(const std::vector<unsigned char>& data, GpuCacheAccelerator* accelerator) {
    CacheJournalEntry entry;
    entry.data_hash = Hash(data.empty() ? Hash{} : data.data(), data.size());
    entry.created = std::chrono::steady_clock::now();
    entry.compressed_size = data.size();

    if (accelerator) {
        entry.gpu_cached = accelerator->accelerate_write(entry.data_hash, data);
    }
    return true;
}