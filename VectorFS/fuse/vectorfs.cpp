#define FUSE_USE_VERSION 31
#include <fuse3/fuse.h>

#include "fuse_ops.h"
#include "../src/metadata_store.h"
#include "../core/superblock.h"
#include "../cas/cas.h"

#include <memory>

int main(int argc, char* argv[]) {
    static CAS cas;
    static Superblock superblock(cas);
    static MetadataStore metadata(cas, superblock);

    // wire into global context
    extern VectorFSContext g_ctx;
    g_ctx.metadata = &metadata;

    return fuse_main(argc, argv, &vectorfs_ops, nullptr);
}
