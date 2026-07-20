#pragma once
#include "../core/node.h"
#include <vector>
#include <cstdint>

namespace vectorfs {

// Compute a hash of raw data.
// Returns a Hash struct with the 32-byte digest.
Hash compute_hash(const std::vector<uint8_t>& data);

} // namespace vectorfs