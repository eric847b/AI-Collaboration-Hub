#pragma once
#include "branch.h"
#include <unordered_map>
#include <string>

namespace vectorfs {

class BranchStore {
public:
    void create(const Branch& b);
    void update(const Branch& b);          // upsert
    bool exists(const std::string& name) const;
    Branch load(const std::string& name) const;

    bool set_current(const std::string& name); // fails unless branch exists
    const std::string& current() const;        // "" if none active

private:
    std::unordered_map<std::string,Branch> branches_;
    std::string current_;
};

}
