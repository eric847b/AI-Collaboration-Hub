#pragma once
#include "../cas/cas.h"
#include <unordered_map>

namespace vectorfs {

class InMemoryCAS : public CAS {
    std::unordered_map<std::string, Node> store;
public:
    Hash put(const Node& n) override {
        // TODO: hash based key
        return Hash{};
    }
    Node get(const Hash& h) override {
        return Node{};
    }
};

} // namespace vectorfs