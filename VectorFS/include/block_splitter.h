#pragma once

#include <vector>

class BlockSplitter {
public:
    std::vector<std::vector<unsigned char>>
    split(const std::vector<unsigned char>& data,
          size_t block_size = 4096);
};
