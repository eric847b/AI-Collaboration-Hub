// Self-contained crash-recovery fixture:
// synthesizes the superblock + journal that RecoveryReplay::replay() consumes,
// then verifies replay() restores a consistent state (exit 0).
#include "../core/recovery_replay.h"
#include "../core/superblock.h"
#include "../core/journal.h"

#include <cstdio>

using namespace vectorfs;

namespace {

// hash_from_hex() throws on strings shorter than 64 hex chars,
// so every journal hash in this fixture must be full width.
const char* kHex64 =
    "deadbeefcafebabe0123456789abcdef"
    "deadbeefcafebabe0123456789abcdef";

} // namespace

int main() {
    // Start from a clean slate (append-mode journal would accumulate runs)
    std::remove("test.journal");
    std::remove("test.superblock");

    // 1) A valid superblock: replay() must find persisted filesystem state
    SuperblockAB sb;
    sb.valid = true;
    sb.version = 1;
    // load() classifies an all-zero root as invalid state, so persist a real
    // (arbitrary) root hash; otherwise replay() can never see a valid superblock.
    for (std::size_t i = 0; i < sb.root.b.size(); ++i)
        sb.root.b[i] = static_cast<unsigned char>(i + 1);
    if (!sb.save("test.superblock")) {
        std::fprintf(stderr, "FAIL: could not write superblock fixture\n");
        return 2;
    }

    // 2) A crash journal: node writes followed by a root commit point
    Journal journal("test.journal");
    if (!journal.append(JournalEntry{JournalOp::NodeWrite, kHex64}) ||
        !journal.append(JournalEntry{JournalOp::NodeWrite, kHex64}) ||
        !journal.append(JournalEntry{JournalOp::RootUpdate, kHex64})) {
        std::fprintf(stderr, "FAIL: could not write journal fixture\n");
        return 3;
    }

    // 3) Recovery must succeed and leave a readable, consistent superblock
    if (!RecoveryReplay::replay("test.journal", "test.superblock")) {
        std::fprintf(stderr, "FAIL: replay rejected a valid fixture\n");
        return 1;
    }

    SuperblockAB after = SuperblockAB::load("test.superblock");
    if (!after.valid) {
        std::fprintf(stderr, "FAIL: superblock unreadable after replay\n");
        return 4;
    }

    std::printf("PASS\n");
    return 0;
}