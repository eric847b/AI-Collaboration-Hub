#pragma once

#include <vector>
#include <unordered_map>
#include <optional>
#include "../core/node.h"

namespace vectorfs {

// Omega Cache: GPU VRAM tier for hot Node traversals
class OmegaCache {
public:
    bool put(const Hash& h, const Node& node);
    std::optional<Node> get(const Hash& h);
    void evict();
    size_t size() const;
};

} // namespace vectorfs