#include "metadata_gc.h"

MetadataGC::MetadataGC(MetadataStore* s) : store(s) {}

void MetadataGC::mark(uint64_t inode_id, std::unordered_set<uint64_t>& reachable) {
    if (reachable.count(inode_id)) return;
    reachable.insert(inode_id);

    Inode* inode = store->get_inode(inode_id);
    if (!inode) return;

    for (auto child : inode->children) {
        mark(child, reachable);
    }
}

void MetadataGC::sweep(const std::unordered_set<uint64_t>& reachable) {
    std::vector<uint64_t> to_delete;

    for (auto& [id, inode] : store->get_inodes()) {
        if (!reachable.count(id)) {
            to_delete.push_back(id);
        }
    }

    for (auto id : to_delete) {
        store->delete_inode(id);
    }
}

void MetadataGC::run_gc(uint64_t root_inode) {
    std::unordered_set<uint64_t> reachable;
    mark(root_inode, reachable);
    sweep(reachable);
}
