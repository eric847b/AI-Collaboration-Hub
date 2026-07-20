#include "metadata_store.h"
#include "node.h"
#include "cas.h"
#include "superblock.h"

#include <cstring>
#include <errno.h>
#include <vector>
#include <string>

using std::string;
using std::vector;

MetadataStore::MetadataStore(CAS& cas, Superblock& sb)
    : cas(cas), superblock(sb) {}

/* ---------------------------------------------------------
 * Helpers
 * --------------------------------------------------------- */

static string basename_of(const char* path) {
    string p(path);
    auto pos = p.find_last_of('/');
    if (pos == string::npos) return p;
    return p.substr(pos + 1);
}

static string parent_of(const char* path) {
    string p(path);
    auto pos = p.find_last_of('/');
    if (pos == string::npos) return "/";
    if (pos == 0) return "/";
    return p.substr(0, pos);
}

Node MetadataStore::load_node(const Hash& h) {
    return cas.get(h);
}

Hash MetadataStore::store_node(const Node& n) {
    return cas.put(n);
}

bool MetadataStore::lookup(const Node& dir, const string& name, Hash& out) {
    for (auto& e : dir.dir_entries) {
        if (e.name == name) {
            out = e.hash;
            return true;
        }
    }
    return false;
}

bool MetadataStore::remove_entry(Node& dir, const string& name) {
    for (size_t i = 0; i < dir.dir_entries.size(); i++) {
        if (dir.dir_entries[i].name == name) {
            dir.dir_entries.erase(dir.dir_entries.begin() + i);
            return true;
        }
    }
    return false;
}

/* ---------------------------------------------------------
 * mkdir
 * --------------------------------------------------------- */

int MetadataStore::mkdir(const char* path, mode_t mode) {
    string parent_path = parent_of(path);
    string name = basename_of(path);

    Hash parent_hash;
    if (!superblock.resolve(parent_path, parent_hash))
        return -ENOENT;

    Node parent = load_node(parent_hash);
    if (!parent.is_directory())
        return -ENOTDIR;

    Hash existing;
    if (lookup(parent, name, existing))
        return -EEXIST;

    Node new_dir = Node::directory();
    new_dir.mode = S_IFDIR | mode;

    Hash new_hash = store_node(new_dir);

    parent.dir_entries.push_back({name, new_hash});
    Hash updated_parent = store_node(parent);

    superblock.update_path(parent_path, updated_parent);
    return 0;
}

/* ---------------------------------------------------------
 * create
 * --------------------------------------------------------- */

int MetadataStore::create(const char* path, mode_t mode, struct fuse_file_info*) {
    string parent_path = parent_of(path);
    string name = basename_of(path);

    Hash parent_hash;
    if (!superblock.resolve(parent_path, parent_hash))
        return -ENOENT;

    Node parent = load_node(parent_hash);
    if (!parent.is_directory())
        return -ENOTDIR;

    Hash existing;
    if (lookup(parent, name, existing))
        return -EEXIST;

    Node file = Node::file();
    file.mode = S_IFREG | mode;

    Hash file_hash = store_node(file);

    parent.dir_entries.push_back({name, file_hash});
    Hash updated_parent = store_node(parent);

    superblock.update_path(parent_path, updated_parent);
    return 0;
}

/* ---------------------------------------------------------
 * unlink
 * --------------------------------------------------------- */

int MetadataStore::unlink(const char* path) {
    string parent_path = parent_of(path);
    string name = basename_of(path);

    Hash parent_hash;
    if (!superblock.resolve(parent_path, parent_hash))
        return -ENOENT;

    Node parent = load_node(parent_hash);
    if (!parent.is_directory())
        return -ENOTDIR;

    Hash child_hash;
    if (!lookup(parent, name, child_hash))
        return -ENOENT;

    Node child = load_node(child_hash);
    if (child.is_directory())
        return -EISDIR;

    remove_entry(parent, name);

    Hash updated_parent = store_node(parent);
    superblock.update_path(parent_path, updated_parent);

    return 0;
}

/* ---------------------------------------------------------
 * rmdir
 * --------------------------------------------------------- */

int MetadataStore::rmdir(const char* path) {
    string parent_path = parent_of(path);
    string name = basename_of(path);

    Hash parent_hash;
    if (!superblock.resolve(parent_path, parent_hash))
        return -ENOENT;

    Node parent = load_node(parent_hash);
    if (!parent.is_directory())
        return -ENOTDIR;

    Hash child_hash;
    if (!lookup(parent, name, child_hash))
        return -ENOENT;

    Node child = load_node(child_hash);
    if (!child.is_directory())
        return -ENOTDIR;

    if (!child.dir_entries.empty())
        return -ENOTEMPTY;

    remove_entry(parent, name);

    Hash updated_parent = store_node(parent);
    superblock.update_path(parent_path, updated_parent);

    return 0;
}
