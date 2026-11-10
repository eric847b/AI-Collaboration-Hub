#include "gc.h"
#include "gc_mark.h"
#include "gc_sweep.h"

namespace vfs::gc {

GarbageCollector::GarbageCollector(vfs::CasStore* cas, vfs::LineageStore* lineage)
    : cas_(cas), lineage_(lineage) {}

void GarbageCollector::run(const std::vector<Hash>& roots) {
    color_.clear();
    mark_phase(roots);
    sweep_phase();
}

void GarbageCollector::mark_phase(const std::vector<Hash>& roots) {
    gc_mark(color_, roots, lineage_);
}

void GarbageCollector::sweep_phase() {
    gc_sweep(color_, cas_);
}

} // namespace vfs::gc
