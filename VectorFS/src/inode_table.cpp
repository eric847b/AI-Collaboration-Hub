#include "inode_table.h"

uint64_t InodeTable::allocate(const std::string& hash) {
    uint64_t inode = next_inode++;
    inode_to_hash[inode] = hash;
    return inode;
}

std::string InodeTable::lookup(uint64_t inode) const {
    auto it = inode_to_hash.find(inode);

    if (it == inode_to_hash.end())
        return "";

    return it->second;
}
