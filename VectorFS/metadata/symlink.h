#pragma once
#include <string>
#include <cstdint>

struct Symlink {
    uint64_t inode_id;
    std::string target;
};
