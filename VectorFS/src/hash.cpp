#include "hash.h"
#include <sstream>
#include <iomanip>

std::string hash_bytes(const std::vector<unsigned char>& data) {
    std::ostringstream ss;
    ss << std::hex << std::setfill('0');
    for (auto byte : data) {
        ss << std::setw(2) << static_cast<unsigned>(byte);
    }
    return ss.str();
}

Hash hash_bytes_raw(const std::vector<unsigned char>& data) {
    Hash h{};
    // Simple FNV-1a-like hash into 32 bytes
    uint64_t lo = 0xcbf29ce484222325ULL;
    uint64_t hi = 0x5851f42d4c957f2dULL;
    for (auto byte : data) {
        lo ^= static_cast<uint64_t>(byte);
        lo *= 0x100000001b3ULL;
        hi ^= static_cast<uint64_t>(byte);
        hi *= 0x100000001b3ULL;
    }
    for (int i = 0; i < 8; ++i) {
        h.b[i]     = static_cast<uint8_t>((lo >> (i * 8)) & 0xFF);
        h.b[i + 8] = static_cast<uint8_t>((hi >> (i * 8)) & 0xFF);
    }
    // Fill remaining bytes with a second pass for diffusion
    uint64_t mix = lo ^ hi;
    for (int i = 16; i < 32; ++i) {
        mix ^= static_cast<uint64_t>(i);
        mix *= 0x100000001b3ULL;
        h.b[i] = static_cast<uint8_t>((mix >> ((i % 8) * 8)) & 0xFF);
    }
    return h;
}
