#include "path_resolver.h"
#include <sstream>

PathResolver::PathResolver(MetadataStore* s) : store(s) {}

std::vector<std::string> PathResolver::split(const std::string& path) {
    std::vector<std::string> parts;
    std::stringstream ss(path);
    std::string item;
    while (std::getline(ss, item, '/')) {
        if (!item.empty()) parts.push_back(item);
    }
    return parts;
}

int64_t PathResolver::resolve(const std::string& path) {
    if (path.empty() || path[0] != '/') return -1;

    auto parts = split(path);
    uint64_t current = 1; // assume inode 1 is root

    for (auto& p : parts) {
        Inode* inode = store->get_inode(current);
        if (!inode || inode->type != InodeType::Directory) return -1;

        // Look up by name in dir_entries
        vfs::DirEntry* entry = store->lookup(current, p);
        if (!entry) return -1;

        current = entry->inode_id;
    }

    return static_cast<int64_t>(current);
}
