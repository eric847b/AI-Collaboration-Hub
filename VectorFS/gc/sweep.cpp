#include "sweep.h"
#include "mark.h"
#include "../metadata/metadata_store.h"

Sweep::Sweep(Mark* mark) : mark_(mark) {}

void Sweep::run() {
    sweep_unreachable();
}

void Sweep::sweep_unreachable() {
    const auto& reachable = mark_->reachable();
    std::vector<uint64_t> to_delete;

    for (auto& [id, inode] : mark_->metadata()->get_inodes()) {
        if (!reachable.count(id)) {
            to_delete.push_back(id);
        }
    }

    for (auto id : to_delete) {
        mark_->metadata()->delete_inode(id);
    }
}
