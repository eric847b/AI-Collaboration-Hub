#include "mark.h"
#include "../metadata/metadata_store.h"

Mark::Mark(MetadataStore* metadata) : metadata_(metadata) {}

void Mark::run(uint64_t root_inode) {
    reachable_set.clear();
    mark_inode(root_inode);
}

void Mark::mark_inode(uint64_t inode_id) {
    if (reachable_set.count(inode_id)) return;
    reachable_set.insert(inode_id);

    Inode* inode = metadata_->get_inode(inode_id);
    if (!inode) return;

    for (auto child : inode->children) {
        mark_inode(child);
    }
}
