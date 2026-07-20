#pragma once

#include <cstdint>
#include <string>
#include <unordered_map>

class InodeTable {
public:
    uint64_t allocate(const std::string& hash);
    std::string lookup(uint64_t inode) const;

private:
    uint64_t next_inode = 1;
    std::unordered_map<uint64_t, std::string> inode_to_hash;
};
