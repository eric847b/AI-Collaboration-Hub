#pragma once
#include "../core/node.h"
#include <unordered_map>
#include <string>

namespace vectorfs {

class LivenessIndex {
public:
    void retain(const Hash& h);
    void release(const Hash& h);
    bool alive(const Hash& h) const;

private:
    std::unordered_map<std::string,size_t> refs_;
};

}
