#pragma once
#include <vector>
#include <queue>
#include <unordered_map>
#include "gc_state.h"
#include "../cas/cas_store.h"
#include "../metadata/lineage.h"
#include "gc/mark.h"
#include "gc/sweep.h"

namespace vfs::gc {

class GarbageCollector {
public:
    // Full constructor with all dependencies for proper dependency injection
    GarbageCollector(vfs::CasStore* cas, vfs::LineageStore* lineage,
                     Mark* mark, Sweep* sweep)
        : cas_(cas), lineage_(lineage), g_mark(mark), g_sweep(sweep) {}

    // Run a full GC cycle with roots
    void run(const std::vector<Hash>& roots);

    // Mark phase only - marks reachable objects from given roots
    void mark(const std::vector<Hash>& roots);

    // Sweep phase only - sweeps unreachable objects
    void sweep();

    // Get the number of colored entries (for debugging/stats)
    size_t color_count() const { return color_.size(); }

private:
    vfs::CasStore* cas_;
    vfs::LineageStore* lineage_;
    Mark* g_mark;
    Sweep* g_sweep;
    std::unordered_map<Hash, GcColor, HashHasher> color_;

    void mark_phase(const std::vector<Hash>& roots);
    void sweep_phase();
};

} // namespace vfs::gc
