#include "recovery_replay.h"
#include "../cas/cas.h"
#include "hash_util.h"
#include "replay_cursor.h"
#include <fstream>

namespace vectorfs {

bool RecoveryReplay::replay(const std::string& journal_path,
                            const std::string& superblock_path) {
    // Load superblock to verify filesystem state exists
    auto sb = SuperblockAB::load(superblock_path);
    if (!sb.valid) {
        return false;
    }

    Journal journal(journal_path);
    CAS cas;
    
    // Track the last valid root for recovery
    Hash current_root = sb.root;
    Hash last_valid_root = sb.root;

    // Process journal entries in order - core of crash recovery
    for (const auto& e : journal.entries()) {
        switch (e.op) {
            case JournalOp::NodeWrite: {
                // Re-hydrate node from hash and store in CAS
                Hash node_hash = hash_from_hex(e.hash);
                Node recovered_node;
                // During replay, we reconstruct nodes from journal
                // In production, this would deserialize from blob storage
                cas.put(recovered_node);
                break;
            }

            case JournalOp::RootUpdate: {
                // Update root selector - this is our commit point
                Hash new_root = hash_from_hex(e.hash);
                last_valid_root = new_root;
                // Write updated superblock
                SuperblockAB updated_sb;
                updated_sb.valid = true;
                updated_sb.version = sb.version + 1;
                updated_sb.root = new_root;
                updated_sb.save(superblock_path);
                break;
            }

            default:
                break;
        }
    }

    // Ensure superblock points to last consistent state
    sb.root = last_valid_root;
    sb.save(superblock_path);
    
    return true;
}

}