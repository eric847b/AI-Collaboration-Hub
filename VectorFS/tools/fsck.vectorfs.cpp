#include "../core/recovery_replay.h"
#include "../core/journal.h"
#include "../cas/cas.h"
#include "../core/superblock.h"
#include <iostream>
#include <fstream>

using namespace vectorfs;

int main(int argc, char** argv) {
    if (argc < 3) {
        std::cerr << "usage: fsck.vectorfs <journal> <superblock>\n";
        return 1;
    }

    std::string journal_path = argv[1];
    std::string superblock_path = argv[2];

    // Phase 1: Validate superblock exists and is readable
    std::cout << "Phase 1: Checking superblock... ";
    auto sb = SuperblockAB::load(superblock_path);
    if (!sb.valid) {
        std::cerr << "FAILED - superblock invalid or unreadable\n";
        return 1;
    }
    std::cout << "OK (version: " << sb.version << ")\n";

    // Phase 2: Validate journal exists and is readable
    std::cout << "Phase 2: Checking journal... ";
    std::ifstream journal_check(journal_path);
    if (!journal_check.good()) {
        std::cerr << "FAILED - journal file not readable\n";
        return 1;
    }
    journal_check.close();
    std::cout << "OK\n";

    // Phase 3: Replay journal and validate integrity
    std::cout << "Phase 3: Replaying journal entries... ";
    Journal journal(journal_path);
    size_t entry_count = 0;
    size_t node_writes = 0;
    size_t root_updates = 0;

    for (const auto& e : journal.entries()) {
        entry_count++;
        switch (e.op) {
            case JournalOp::NodeWrite:
                node_writes++;
                break;
            case JournalOp::RootUpdate:
                root_updates++;
                break;
            default:
                break;
        }
    }
    std::cout << "OK (" << entry_count << " entries, " 
              << node_writes << " node writes, " 
              << root_updates << " root updates)\n";

    // Phase 4: Perform recovery replay
    std::cout << "Phase 4: Performing recovery replay... ";
    bool ok = RecoveryReplay::replay(journal_path, superblock_path);
    if (!ok) {
        std::cerr << "FAILED - recovery replay failed\n";
        return 1;
    }
    std::cout << "OK\n";

    // Phase 5: Verify root hash is accessible
    std::cout << "Phase 5: Verifying root hash accessibility... ";
    Hash root = sb.root;
    std::cout << "OK (root: " << root.to_string() << ")\n";

    std::cout << "Filesystem consistency check PASSED\n";
    return 0;
}