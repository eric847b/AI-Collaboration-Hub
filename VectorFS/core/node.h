#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <string>
#include <sys/stat.h>
#include <vector>
#include <sstream>
#include <iomanip>

struct Hash {
    std::array<uint8_t, 32> b{};

    bool operator==(const Hash& other) const {
        return b == other.b;
    }

    bool operator!=(const Hash& other) const {
        return !(*this == other);
    }

    std::string to_string() const {
        std::ostringstream oss;
        oss << std::hex << std::setfill('0');
        for (auto byte : b) {
            oss << std::setw(2) << static_cast<unsigned>(byte);
        }
        return oss.str();
    }
};

struct HashHasher {
    std::size_t operator()(const Hash& h) const noexcept {
        std::size_t v = 0;
        for (auto byte : h.b) {
            v = (v * 131) ^ byte;
        }
        return v;
    }
};

struct DirEntry {
    std::string name;
    Hash hash;
};

struct Node {
    Hash hash{};
    mode_t mode = 0;
    std::vector<uint8_t> data;
    std::vector<Hash> children;
    std::vector<DirEntry> dir_entries;

    static Node directory() {
        Node n;
        n.mode = S_IFDIR | 0755;
        return n;
    }

    static Node file() {
        Node n;
        n.mode = S_IFREG | 0644;
        return n;
    }

    bool is_directory() const {
        return S_ISDIR(mode);
    }

    bool is_file() const {
        return S_ISREG(mode);
    }
};
