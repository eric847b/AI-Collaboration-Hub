#include "snapshot.h"

#include <ctime>

void SnapshotStore::create_snapshot(const std::string& root_hash) {
    snapshots_.push_back({
        root_hash,
        static_cast<uint64_t>(std::time(nullptr))
    });
}

std::vector<Snapshot> SnapshotStore::list_snapshots() const {
    return snapshots_;
}
