#pragma once
#include <cstddef>
#include <cstdint>
#include <string>

struct GPU_Page {
    uint64_t id;
    size_t size;
    std::string cas_hash;
    bool resident;
    uint64_t last_lineage;
};
