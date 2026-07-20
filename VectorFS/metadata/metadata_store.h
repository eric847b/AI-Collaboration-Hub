#pragma once
#include <string>
#include <unordered_map>
#include "inode.h"
#include "dir_entry.h"

class MetadataStore {
public:
    MetadataStore();

    Inode* get_inode(uint64_t id);
    const Inode* get_inode(uint64_t id) const;
    uint64_t create_inode(InodeType type);
    void delete_inode(uint64_t id);

    void add_dir_entry(uint64_t dir_inode, const vfs::DirEntry& entry);
    void remove_dir_entry(uint64_t dir_inode, const std::string& name);
    vfs::DirEntry* lookup(uint64_t dir_inode, const std::string& name);

    // Expose inodes for iteration (used by GC sweep)
    std::unordered_map<uint64_t, Inode>& get_inodes() { return inodes; }
    const std::unordered_map<uint64_t, Inode>& get_inodes() const { return inodes; }

private:
    uint64_t next_inode_id;
    std::unordered_map<uint64_t, Inode> inodes;
};
