#pragma once
#include "node.h"
#include <sstream>
#include <iomanip>
#include <stdexcept>

namespace vectorfs {

inline std::string hash_hex(const Hash& h) {
    std::ostringstream ss;

    for (auto b : h.b) {
        ss << std::hex
           << std::setw(2)
           << std::setfill('0')
           << static_cast<int>(b);
    }

    return ss.str();
}

// Parse a hex string back into a Hash struct
inline Hash hash_from_hex(const std::string& hex) {
    Hash h{};
    if (hex.length() < 64) {
        throw std::invalid_argument("Hash hex string too short");
    }
    for (int i = 0; i < 32; ++i) {
        std::string byte_str = hex.substr(i * 2, 2);
        h.b[i] = static_cast<uint8_t>(std::stoul(byte_str, nullptr, 16));
    }
    return h;
}

} // namespace vectorfs