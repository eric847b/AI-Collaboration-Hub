#pragma once
#include <vector>
#include <cstdint>

struct Blob {
    std::vector<uint8_t> data;
    bool in_gpu = false;
};
