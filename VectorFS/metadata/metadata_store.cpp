#include "metadata_store.h"

MetadataStore::MetadataStore() : next_inode_id(1) {}

Inode* MetadataStore::get_inode(uint64_t id) {
    auto it = inodes.find(id);
    if (it == inodes.end()) return nullptr;
    return &it->second;
}

const Inode* MetadataStore::get_inode(uint64_t id) const {
    auto it = inodes.find(id);
    if (it == inodes.end()) return nullptr;
    return &it->second;
}

uint64_t MetadataStore::create_inode(InodeType type) {
    uint64_t id = next_inode_id++;
    Inode inode;
    inode.id = id;
    inode.type = type;
    inode.size = 0;
    inode.created = inode.modified = 0;
    inodes[id] = inode;
    return id;
}

void MetadataStore::delete_inode(uint64_t id) {
    inodes.erase(id);
}

void MetadataStore::add_dir_entry(uint64_t dir_inode, const vfs::DirEntry& entry) {
    Inode* inode = get_inode(dir_inode);
    if (!inode || inode->type != InodeType::Directory) return;

    // Store the child inode ID in the children vector
    inode->children.push_back(entry.inode_id);

    // Also store the DirEntry for name-based lookup
    inode->dir_entries.push_back(entry);
}

void MetadataStore::remove_dir_entry(uint64_t dir_inode, const std::string& name) {
    Inode* inode = get_inode(dir_inode);
    if (!inode || inode->type != InodeType::Directory) return;

    // Find the entry by name to get the inode_id
    uint64_t target_id = 0;
    for (auto it = inode->dir_entries.begin(); it != inode->dir_entries.end(); ++it) {
        if (it->name == name) {
            target_id = it->inode_id;
            inode->dir_entries.erase(it);
            break;
        }
    }

    // Remove from children vector if found
    if (target_id != 0) {
        for (auto it = inode->children.begin(); it != inode->children.end(); ++it) {
            if (*it == target_id) {
                inode->children.erase(it);
                break;
            }
        }
    }
}

vfs::DirEntry* MetadataStore::lookup(uint64_t dir_inode, const std::string& name) {
    Inode* inode = get_inode(dir_inode);
    if (!inode || inode->type != InodeType::Directory) return nullptr;

    for (auto& entry : inode->dir_entries) {
        if (entry.name == name) {
            return &entry;
        }
    }
    return nullptr;
}