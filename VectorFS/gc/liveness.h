#pragma once
#include <unordered_set>
#include <cstdint>

class Liveness {
public:
    bool is_reachable(uint64_t inode_id) const;

    void set_reachable(const std::unordered_set<uint64_t>& set);

private:
    std::unordered_set<uint64_t> reachable_set;
};
