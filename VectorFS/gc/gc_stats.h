#pragma once
#include <cstdint>

struct GC_Stats {
    uint64_t inodes_before;
    uint64_t inodes_after;
    uint64_t reclaimed;
};
