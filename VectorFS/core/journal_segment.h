#pragma once
#include <string>
#include <cstdint>

namespace vectorfs {

struct JournalSegment {
    std::string path;
    uint64_t generation = 0;
    uint64_t entry_count = 0;
};

}
