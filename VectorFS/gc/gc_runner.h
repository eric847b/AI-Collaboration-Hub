#pragma once
#include "gc.h"
#include "cas/cas_store.h"
#include "metadata/metadata_store.h"
#include "gc/mark.h"
#include "gc/sweep.h"

namespace vfs::gc {

// Runner class that orchestrates a full GC cycle with proper dependency injection
class GarbageCollectorRunner {
public:
    GarbageCollectorRunner(CasStore* cas, LineageStore* lineage,
                           MetadataStore* metadata, Mark* mark, Sweep* sweep)
        : collector_(cas, lineage, metadata, mark, sweep) {}

    // Run a full GC cycle with the given roots
    void run(const std::vector<Hash>& roots) {
        collector_.run(roots);
    }

    // Mark phase only - marks reachable objects from given roots
    void mark(const std::vector<Hash>& roots) {
        collector_.mark(roots);
    }

    // Sweep phase only - sweeps unreachable objects
    void sweep() {
        collector_.sweep();
    }

    // Get collector stats for debugging
    size_t color_count() const {
        return collector_.color_count();
    }

    // Convenience: run mark only
    void mark_only(const std::vector<Hash>& roots) {
        collector_.mark(roots);
    }

    // Convenience: run sweep only
    void sweep_only() {
        collector_.sweep();
    }

private:
    GarbageCollector collector_;
};

} // namespace vfs::gc
