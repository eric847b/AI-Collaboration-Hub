#include "sweep.h"
#include "mark.h"
#include "../metadata/metadata_store.h"

extern MetadataStore* g_metadata;
extern Mark* g_mark;

Sweep::Sweep() {}

void Sweep::run() {
    sweep_unreachable();
}

void Sweep::sweep_unreachable() {
    const auto& reachable = g_mark->reachable();
    std::vector<uint64_t> to_delete;

    for (auto& [id, inode] : g_metadata->get_inodes()) {
        if (!reachable.count(id)) {
            to_delete.push_back(id);
        }
    }

    for (auto id : to_delete) {
        g_metadata->delete_inode(id);
    }
}
