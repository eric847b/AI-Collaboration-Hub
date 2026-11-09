#include "persistence.h"
#include "gpu_cache.h"
#include "cas/cas_store.h"
#include "metadata/metadata_store.h"

// Global cache accelerator (initialized during bootstrap)
static GpuCacheAccelerator* g_cache_accelerator = nullptr;

bool Persistence::load_superblock(Superblock& sb) {
    // Initialize cache accelerator if not already done
    if (!g_cache_accelerator) {
        g_cache_accelerator = new GpuCacheAccelerator(
            /* cas */ nullptr,  // Will be set during bootstrap
            /* metadata */ nullptr,
            /* gpu_ram_mb */ 512  // Default 512MB GPU cache
        );
    }
    return Superblock::load_superblock(sb);
}

bool Persistence::save_superblock(const Superblock& sb) {
    if (g_cache_accelerator) {
        // GC cache periodically
        g_cache_accelerator->gc_cache(std::chrono::minutes(30));
    }
    return Superblock::save_superblock(sb);
}

bool Persistence::write_object(const std::string& path,
                               const std::vector<unsigned char>& data) {
    // Accelerate write: GPU RAM first, then storage
    if (g_cache_accelerator) {
        Hash key = /* compute hash from path/data */ Hash{};
        g_cache_accelerator->accelerate_write(key, data);
    }
    // Always persist to storage
    return Superblock::save_superblock(sb);  // Placeholder
}

bool Persistence::read_object(const std::string& path,
                              std::vector<unsigned char>& data) {
    // Accelerate read: GPU cache first, then storage
    if (g_cache_accelerator) {
        Hash key = /* compute hash from path */ Hash{};
        if (g_cache_accelerator->accelerate_read(key, data)) {
            return true;  // Cache hit
        }
    }
    // Fallback: read from storage
    return Superblock::load_superblock(/* superblock */ sb);  // Placeholder
}
