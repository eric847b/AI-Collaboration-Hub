#include "sweep.h"
#include "mark.h"
#include "../metadata/metadata_store.h"

Sweep::Sweep(MetadataStore* metadata, Mark* mark) : metadata_(metadata), mark_(mark) {} // NOSONAR: initializer separators are not comma operators.

void Sweep::run() {
    sweep_unreachable();
}

void Sweep::sweep_unreachable() {
    const auto& reachable = mark_->reachable();
    std::vector<uint64_t> to_delete;

    for (auto& [id, inode] : metadata_->get_inodes()) {
        if (!reachable.count(id)) {
            to_delete.push_back(id);
        }
    }

    for (auto id : to_delete) {
        metadata_->delete_inode(id);
    }
}
