#include "fuse_ops.h"
#include "metadata_store.h"
#include "superblock.h"
#include "cas.h"
#include "node.h"

#include <cstring>
#include <cerrno>
#include <sys/stat.h>

VectorFSContext g_ctx;

void* vectorfs_init(struct fuse_conn_info*, struct fuse_config* cfg) {
    cfg->kernel_cache = 1;
    return &g_ctx;
}

int vectorfs_mkdir(const char* path, mode_t mode) {
    return g_ctx.metadata->mkdir(path, mode);
}

int vectorfs_create(const char* path, mode_t mode, struct fuse_file_info* fi) {
    return g_ctx.metadata->create(path, mode, fi);
}

int vectorfs_unlink(const char* path) {
    return g_ctx.metadata->unlink(path);
}

int vectorfs_rmdir(const char* path) {
    return g_ctx.metadata->rmdir(path);
}

int vectorfs_getattr(const char* path, struct stat* stbuf, struct fuse_file_info*) {
    memset(stbuf, 0, sizeof(struct stat));

    if (strcmp(path, "/") == 0) {
        stbuf->st_mode = S_IFDIR | 0755;
        stbuf->st_nlink = 2;
        return 0;
    }

    // Skeleton: say "no such file" for everything else for now
    return -ENOENT;
}

struct fuse_operations vectorfs_ops = {
    .getattr = vectorfs_getattr,
    .mkdir   = vectorfs_mkdir,
    .unlink  = vectorfs_unlink,
    .rmdir   = vectorfs_rmdir,
    .init    = vectorfs_init,
    .create  = vectorfs_create,
};
