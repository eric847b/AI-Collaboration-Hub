#pragma once

#include "node.h"
#include "cas.h"
#include "superblock.h"

#include <string>
#include <sys/stat.h>

struct fuse_file_info;

// CAS-based metadata store that uses the CAS and Superblock
// for persistent storage. This is distinct from the inode-based
// MetadataStore in metadata/metadata_store.h.
class MetadataStore {
public:
    MetadataStore(CAS& cas, Superblock& sb);

    Node load_node(const Hash& h);
    Hash store_node(const Node& n);
    bool lookup(const Node& dir, const std::string& name, Hash& out);
    bool remove_entry(Node& dir, const std::string& name);

    int mkdir(const char* path, mode_t mode);
    int create(const char* path, mode_t mode, struct fuse_file_info* fi);
    int unlink(const char* path);
    int rmdir(const char* path);

private:
    CAS& cas;
    Superblock& superblock;
};