#include "branch_store.h"

namespace vectorfs {

void BranchStore::create(const Branch& b) {
    branches_[b.name] = b;
}

bool BranchStore::exists(const std::string& name) const {
    return branches_.find(name) != branches_.end();
}

Branch BranchStore::load(const std::string& name) const {
    auto it = branches_.find(name);
    if (it == branches_.end())
        return {};

    return it->second;
}

}
