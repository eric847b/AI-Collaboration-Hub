#pragma once
#include <cstdint>
#include <unordered_map>
#include "../core/node.h"

namespace vfs::gc {

enum class GcColor : uint8_t {
    White = 0,
    Gray  = 1,
    Black = 2
};

// ColorMap used by both mark and sweep phases
using ColorMap = std::unordered_map<Hash, GcColor, HashHasher>;

} // namespace vfs::gc
