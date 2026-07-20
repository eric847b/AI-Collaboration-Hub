#include "snapshot.h"

#include <cassert>

void test_lists_snapshots_in_creation_order() {
    SnapshotStore store;

    store.create_snapshot("root-a");
    store.create_snapshot("root-b");

    const auto snapshots = store.list_snapshots();

    assert(snapshots.size() == 2);
    assert(snapshots[0].root_hash == "root-a");
    assert(snapshots[1].root_hash == "root-b");
}
