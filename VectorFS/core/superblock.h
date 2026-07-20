#pragma once

#include "../cas/cas.h"
#include <string>
#include <unordered_map>
#include <cstdint>

class Superblock {
public:
    explicit Superblock(CAS& cas);

    bool resolve(const std::string& path, Hash& out) const;
    void update_path(const std::string& path, const Hash& h);

    Hash root_hash() const;

private:
    CAS& cas;
    std::unordered_map<std::string, Hash> path_index;
    uint64_t version = 1;
};

// Serialized superblock state for persistence / recovery
struct SuperblockAB {
    bool valid = false;
    uint32_t version = 0;  // Changed to match binary format
    Hash root{};

    static SuperblockAB load(const std::string& path);
    bool save(const std::string& path) const;
};