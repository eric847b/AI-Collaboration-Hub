#include "../core/recovery_replay.h"

using namespace vectorfs;

int main() {

    bool ok = RecoveryReplay::replay(
        "test.journal",
        "test.superblock"
    );

    return ok ? 0 : 1;
}
