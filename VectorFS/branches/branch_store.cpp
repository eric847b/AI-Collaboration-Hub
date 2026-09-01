#include "branch_store.h"

namespace vectorfs {

void BranchStore::create(const Branch& b) {
    branches_[b.name] = b;
}

bool BranchStore::exists(const std::string& name) const {
    return branches_.find(name) != branches_.end();
}

void BranchStore::update(const Branch& b) {
    branches_[b.name] = b;
}

Branch BranchStore::load(const std::string& name) const {
    auto it = branches_.find(name);
    if (it == branches_.end())
        return {};

    return it->second;
}

bool BranchStore::set_current(const std::string& name) {
    if (!exists(name))
        return false;
    current_ = name;
    return true;
}

const std::string& BranchStore::current() const {
    return current_;
}

}
