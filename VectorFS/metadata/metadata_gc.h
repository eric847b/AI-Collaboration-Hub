#pragma once

#include <cstdint>
#include <unordered_set>
#include "metadata_store.h"

class MetadataGC {
public:
    explicit MetadataGC(MetadataStore* store);

    void mark(uint64_t inode_id, std::unordered_set<uint64_t>& reachable);
    void sweep(const std::unordered_set<uint64_t>& reachable);
    void run_gc(uint64_t root_inode);

private:
    MetadataStore* store;
};