#pragma once
#include "journal.h"
#include "node.h"
#include "hash_util.h"
#include <string>
#include <vector>
#include <utility>
#include <atomic>
#include <ctime>
#include <stdexcept>

namespace vectorfs {

enum class TransactionState {
    Active,
    Committed,
    Aborted,
    Failed
};

class TransactionManager {
    Journal& journal_;
    std::string superblock_path_;
    std::vector<Node> pending_nodes_;
    std::vector<std::string> committed_node_hashes_;
    Hash root_{};
    TransactionState state_ = TransactionState::Active;

public:
    TransactionManager(Journal& journal, std::string superblock_path)
        : journal_(journal),
          superblock_path_(std::move(superblock_path)) {}

    void add_node(const Node& n) {
        if (state_ != TransactionState::Active) {
            throw std::runtime_error("Transaction not in active state");
        }
        pending_nodes_.push_back(n);
    }

    void set_root(const Hash& h) {
        root_ = h;
    }

    // Write transaction to journal (does not update superblock)
    // Caller is responsible for atomic superblock update
    bool commit() {
        if (state_ != TransactionState::Active) {
            return false;
        }

        // Write all node operations to journal
        for (const auto& n : pending_nodes_) {
            std::string node_hash = hash_hex(n.hash);
            if (!journal_.append({
                    JournalOp::NodeWrite,
                    node_hash
                })) {
                state_ = TransactionState::Failed;
                return false;
            }
            committed_node_hashes_.push_back(node_hash);
        }

        // Write root update to journal
        if (!journal_.append({
                JournalOp::RootUpdate,
                hash_hex(root_)
            })) {
            state_ = TransactionState::Failed;
            rollback();
            return false;
        }

        state_ = TransactionState::Committed;
        return true;
    }

    // Rollback - clears pending state
    void rollback() {
        pending_nodes_.clear();
        committed_node_hashes_.clear();
        state_ = TransactionState::Aborted;
    }

    TransactionState state() const { return state_; }
};

} // namespace vectorfs