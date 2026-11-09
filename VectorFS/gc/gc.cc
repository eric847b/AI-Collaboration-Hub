#include "gc.h"
#include "gc_mark.h"
#include "gc_sweep.h"
#include "gc_runner.h"

namespace vfs::gc {

GarbageCollector::GarbageCollector(vfs::CasStore* cas, vfs::LineageStore* lineage,
                                   Mark* mark, Sweep* sweep)
    : cas_(cas), lineage_(lineage), g_mark(mark), g_sweep(sweep) {}

void GarbageCollector::run(const std::vector<Hash>& roots) {
    color_.clear();
    mark_phase(roots);
    sweep_phase();
}

void GarbageCollector::mark(const std::vector<Hash>& roots) {
    color_.clear();
    mark_phase(roots);
}

void GarbageCollector::sweep() {
    g_sweep->run();
}

void GarbageCollector::mark_phase(const std::vector<Hash>& roots) {
    gc_mark(color_, roots, lineage_);
}

void GarbageCollector::sweep_phase() {
    g_sweep->run();
}

} // namespace vfs::gc
