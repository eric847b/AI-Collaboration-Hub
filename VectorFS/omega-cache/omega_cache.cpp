#include "omega_cache.h"

namespace vectorfs {

bool OmegaCache::put(const Hash& h, const Node& node) {
    // TODO: GPU buffer management
    return true;
}

std::optional<Node> OmegaCache::get(const Hash& h) {
    // TODO: GPU lookup
    return std::nullopt;
}

void OmegaCache::evict() {
    // TODO: LRU / ARC eviction
}

size_t OmegaCache::size() const {
    return 0;
}

} // namespace vectorfs