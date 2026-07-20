#include "liveness_index.h"

namespace vectorfs {

static std::string k(const Hash& h) {
    return h.to_string();
}

void LivenessIndex::retain(const Hash& h) {
    refs_[k(h)]++;
}

void LivenessIndex::release(const Hash& h) {
    auto it = refs_.find(k(h));
    if (it == refs_.end())
        return;

    if (it->second > 0)
        --it->second;

    if (it->second == 0)
        refs_.erase(it);
}

bool LivenessIndex::alive(const Hash& h) const {
    return refs_.find(k(h)) != refs_.end();
}

}
