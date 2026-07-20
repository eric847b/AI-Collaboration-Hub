#include "block_splitter.h"
#include <algorithm>

std::vector<std::vector<unsigned char>>
BlockSplitter::split(const std::vector<unsigned char>& data,
                     size_t block_size) {
    std::vector<std::vector<unsigned char>> blocks;

    for (size_t i = 0; i < data.size(); i += block_size) {
        size_t end = std::min(i + block_size, data.size());

        blocks.emplace_back(data.begin() + i,
                            data.begin() + end);
    }

    return blocks;
}
