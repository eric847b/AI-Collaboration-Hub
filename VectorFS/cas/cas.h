#pragma once

#include "../core/node.h"
#include <unordered_map>

class CAS {
public:
    virtual ~CAS() = default;

    virtual Hash put(const Node& n);
    virtual Node get(const Hash& h) const;
    
    // Content-based hash computation for deduplication
    Hash hash_node(const Node& n);

protected:
    std::unordered_map<Hash, Node, HashHasher> store;
    std::size_t counter = 0;
};