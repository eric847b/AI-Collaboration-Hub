#pragma once
#include <string>
#include "inode.h"
#include "dir_entry.h"

class MetadataSerializer {
public:
    static std::string serialize_inode(const Inode& inode);
    static Inode deserialize_inode(const std::string& data);

    static std::string serialize_dir(const std::vector<vfs::DirEntry>& entries);
    static std::vector<vfs::DirEntry> deserialize_dir(const std::string& data);
};
