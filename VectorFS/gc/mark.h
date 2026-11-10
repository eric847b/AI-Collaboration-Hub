#pragma once
#include <unordered_set>
#include <cstdint>

class MetadataStore;

class Mark {
public:
    explicit Mark(MetadataStore* metadata);
    void run(uint64_t root_inode);

    const std::unordered_set<uint64_t>& reachable() const {
        return reachable_set;
    }

private:
    MetadataStore* metadata_;
    std::unordered_set<uint64_t> reachable_set;

    void mark_inode(uint64_t inode_id);
};
