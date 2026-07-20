#include "liveness.h"

bool Liveness::is_reachable(uint64_t inode_id) const {
    return reachable_set.count(inode_id) > 0;
}

void Liveness::set_reachable(const std::unordered_set<uint64_t>& set) {
    reachable_set = set;
}
