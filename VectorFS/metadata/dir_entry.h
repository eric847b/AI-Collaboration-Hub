#pragma once
#include <string>
#include <cstdint>

namespace vfs {

// Inode-based directory entry used by MetadataStore.
// This is distinct from the CAS-based DirEntry in core/node.h.
struct DirEntry {
    std::string name;
    uint64_t inode_id;
    bool is_dir;
};

} // namespace vfs