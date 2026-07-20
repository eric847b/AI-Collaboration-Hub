#include "directory.h"
#include <algorithm>

using vfs::DirEntry;

Directory::Directory(uint64_t inode_id) : id(inode_id) {}

void Directory::add(const DirEntry& entry) {
    entries.push_back(entry);
}

void Directory::remove(const std::string& name) {
    entries.erase(
        std::remove_if(entries.begin(), entries.end(),
                       [&](const DirEntry& e){ return e.name == name; }),
        entries.end()
    );
}

DirEntry* Directory::find(const std::string& name) {
    for (auto& e : entries) {
        if (e.name == name) return &e;
    }
    return nullptr;
}

const std::vector<DirEntry>& Directory::list() const {
    return entries;
}
