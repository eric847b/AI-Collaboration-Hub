#pragma once
#include <cstdint>
#include <string>
#include <vector>
#include "dir_entry.h"

class Directory {
public:
    Directory(uint64_t inode_id);

    void add(const vfs::DirEntry& entry);
    void remove(const std::string& name);
    vfs::DirEntry* find(const std::string& name);
    const std::vector<vfs::DirEntry>& list() const;

private:
    uint64_t id;
    std::vector<vfs::DirEntry> entries;
};
