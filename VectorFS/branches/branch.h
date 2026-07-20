#pragma once
#include "../core/node.h"
#include <string>

namespace vectorfs {

struct Branch {
    std::string name;
    Hash root;
    uint64_t generation;
    uint64_t parent_generation;
};

}
