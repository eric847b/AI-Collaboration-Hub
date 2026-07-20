#pragma once
#include <cstdint>
#include <string>
#include <vector>
#include "metadata_store.h"

class PathResolver {
public:
    PathResolver(MetadataStore* store);

    // Returns inode ID or -1 on failure
    int64_t resolve(const std::string& path);

private:
    MetadataStore* store;

    std::vector<std::string> split(const std::string& path);
};
