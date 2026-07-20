#include "cas_index.h"

namespace vectorfs {

void CASIndex::insert(const Hash& h, const std::string& path) {
    index_[h.to_string()] = path;
}

bool CASIndex::lookup(const Hash& h, std::string& out) const {
    auto it = index_.find(h.to_string());
    if (it == index_.end())
        return false;

    out = it->second;
    return true;
}

}
