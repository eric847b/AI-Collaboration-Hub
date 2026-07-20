#pragma once

#include <sys/types.h>

#define FUSE_USE_VERSION 31
#include <fuse3/fuse.h>

class MetadataStore;

struct VectorFSContext {
    MetadataStore* metadata;
};

extern struct fuse_operations vectorfs_ops;

void* vectorfs_init(struct fuse_conn_info* conn, struct fuse_config* cfg);
int   vectorfs_mkdir(const char* path, mode_t mode);
int   vectorfs_create(const char* path, mode_t mode, struct fuse_file_info* fi);
int   vectorfs_unlink(const char* path);
int   vectorfs_rmdir(const char* path);
int   vectorfs_getattr(const char* path, struct stat* stbuf, struct fuse_file_info* fi);
