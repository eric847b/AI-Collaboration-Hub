#include "gc/gc_runner.h"
#include "metadata/metadata_store.h"

int main() {
    MetadataStore metadata;
    const auto root = metadata.create_inode(InodeType::Directory);
    const auto child = metadata.create_inode(InodeType::File);
    const auto unreachable = metadata.create_inode(InodeType::File);
    metadata.get_inode(root)->children.push_back(child);

    GC_Runner runner(&metadata);
    runner.run(root);

    return metadata.get_inode(root) && metadata.get_inode(child) &&
            !metadata.get_inode(unreachable) ? 0 : 1;
}
