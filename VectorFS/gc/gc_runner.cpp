#include "gc_runner.h"
#include "../metadata/metadata_store.h"
#include "sweep.h"

GC_Runner::GC_Runner(MetadataStore* metadata) : mark_(metadata) {}

void GC_Runner::run(uint64_t root_inode) {
    mark_.run(root_inode);
    Sweep sweep(&mark_);
    sweep.run();
}
