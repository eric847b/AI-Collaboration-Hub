#pragma once

#include <string>
#include <unordered_set>

class GarbageCollector {
public:
    void mark_from_root(const std::string& root_hash);
    void sweep();

private:
    std::unordered_set<std::string> reachable;
};
