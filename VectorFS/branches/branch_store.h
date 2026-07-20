#pragma once
#include "branch.h"
#include <unordered_map>
#include <string>

namespace vectorfs {

class BranchStore {
public:
    void create(const Branch& b);
    bool exists(const std::string& name) const;
    Branch load(const std::string& name) const;

private:
    std::unordered_map<std::string,Branch> branches_;
};

}
