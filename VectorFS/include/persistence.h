#pragma once

#include <string>
#include <vector>
#include "superblock.h"

class Persistence {
public:
    bool load_superblock(Superblock& sb);
    bool save_superblock(const Superblock& sb);

    bool write_object(const std::string& hash,
                      const std::vector<unsigned char>& data);

    bool read_object(const std::string& hash,
                     std::vector<unsigned char>& data);
};
