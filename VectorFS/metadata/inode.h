#pragma once
#include <string>
#include <vector>
#include <cstdint>
#include "dir_entry.h"

enum class InodeType {
    File,
    Directory,
    Symlink
};

struct Inode {
    uint64_t id = 0;
    InodeType type = InodeType::File;

    uint64_t size = 0;
    uint64_t created = 0;
    uint64_t modified = 0;

    // CAS reference for file contents
    std::string cas_ref;

    // Directory children (inode IDs)
    std::vector<uint64_t> children;

    // Directory entries (for name-based lookup)
    std::vector<vfs::DirEntry> dir_entries;

    // Symlink target
    std::string symlink_target;
};
