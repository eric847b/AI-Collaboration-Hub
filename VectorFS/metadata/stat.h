#pragma once
#include <cstdint>

struct StatInfo {
    uint64_t inode_id;
    uint64_t size;
    uint64_t created;
    uint64_t modified;
    bool is_dir;
    bool is_symlink;
};
