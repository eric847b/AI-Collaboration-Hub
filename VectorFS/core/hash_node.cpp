#include "node.h"
#include <vector>

namespace vectorfs {

// deterministic flattening of a Node into bytes
static std::vector<uint8_t> serialize(const Node& n) {
    std::vector<uint8_t> out;

    // include payload
    out.insert(out.end(), n.data.begin(), n.data.end());

    // include children hashes
    for (const auto& c : n.children) {
        out.insert(out.end(), c.b.begin(), c.b.end());
    }

    return out;
}

// core invariant: identical Node → identical Hash
Hash hash_node(const Node& n) {
    Hash h{};

    auto serialized = serialize(n);

    // FNV-1a hash into 32 bytes (replaces OpenSSL SHA-256 dependency)
    uint64_t lo = 0xcbf29ce484222325ULL;
    uint64_t hi = 0x5851f42d4c957f2dULL;
    for (auto byte : serialized) {
        lo ^= static_cast<uint64_t>(byte);
        lo *= 0x100000001b3ULL;
        hi ^= static_cast<uint64_t>(byte);
        hi *= 0x100000001b3ULL;
    }
    for (int i = 0; i < 8; ++i) {
        h.b[i]     = static_cast<uint8_t>((lo >> (i * 8)) & 0xFF);
        h.b[i + 8] = static_cast<uint8_t>((hi >> (i * 8)) & 0xFF);
    }
    uint64_t mix = lo ^ hi;
    for (int i = 16; i < 32; ++i) {
        mix ^= static_cast<uint64_t>(i);
        mix *= 0x100000001b3ULL;
        h.b[i] = static_cast<uint8_t>((mix >> ((i % 8) * 8)) & 0xFF);
    }
    return h;
}

} // namespace vectorfs
