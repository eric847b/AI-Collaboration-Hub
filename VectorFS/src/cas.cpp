#include "cas.h"
#include "../include/hash.h"

// Content-based hash computation
Hash CAS::hash_node(const Node& n) {
    // Compute hash from node content for true content-addressable storage
    std::vector<unsigned char> data;
    
    // Hash the node's mode
    for (int i = 0; i < sizeof(n.mode); ++i) {
        data.push_back(static_cast<unsigned char>((n.mode >> (i * 8)) & 0xFF));
    }
    
    // Hash the data content
    for (auto byte : n.data) {
        data.push_back(byte);
    }
    
    // Hash the children references
    for (const auto& child : n.children) {
        for (auto byte : child.b) {
            data.push_back(byte);
        }
    }
    
    // Hash directory entries
    for (const auto& entry : n.dir_entries) {
        for (auto byte : entry.name) {
            data.push_back(static_cast<unsigned char>(byte));
        }
        for (auto byte : entry.hash.b) {
            data.push_back(byte);
        }
    }
    
    return hash_bytes_raw(data);
}

Hash CAS::put(const Node& n) {
    Hash h = hash_node(n);
    store[h] = n;
    return h;
}

Node CAS::get(const Hash& h) const {
    auto it = store.find(h);
    if (it == store.end()) {
        // for skeleton, return empty node
        return Node{};
    }
    return it->second;
}