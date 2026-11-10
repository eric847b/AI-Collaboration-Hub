#include "gc_runner.h"
#include "../metadata/metadata_store.h"

GC_Runner::GC_Runner(MetadataStore* metadata)
    : mark_(metadata), sweep_(metadata, &mark_) {}

void GC_Runner::run(uint64_t root_inode) {
    mark_.run(root_inode);
    sweep_.run();
}
