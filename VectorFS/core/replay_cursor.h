#pragma once
#include <cstdint>

namespace vectorfs {

struct ReplayCursor {
    uint64_t generation = 0;
    uint64_t offset = 0;
};

}
