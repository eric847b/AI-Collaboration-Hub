#include "gc_runner.h"
#include "mark.h"
#include "sweep.h"

GC_Runner::GC_Runner(CasStore* cas, LineageStore* lineage,
                     MetadataStore* metadata, Mark* mark, Sweep* sweep)
    : runner_(cas, lineage, metadata, mark, sweep) {}

void GC_Runner::run(const std::vector<Hash>& roots) {
    runner_.run(roots);
}

void GC_Runner::mark(const std::vector<Hash>& roots) {
    runner_.mark(roots);
}

void GC_Runner::sweep() {
    runner_.sweep();
}
