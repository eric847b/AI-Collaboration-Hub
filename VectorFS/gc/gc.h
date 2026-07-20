#pragma once
#include <vector>
#include <queue>
#include <unordered_map>
#include "gc_state.h"
#include "../cas/cas_store.h"
#include "../metadata/lineage.h"

namespace vfs::gc {

class GarbageCollector {
public:
    GarbageCollector(vfs::CasStore* cas, vfs::LineageStore* lineage);

    // Run a full GC cycle
    void run(const std::vector<Hash>& roots);

private:
    vfs::CasStore* cas_;
    vfs::LineageStore* lineage_;
    std::unordered_map<Hash, GcColor, HashHasher> color_;

    void mark_phase(const std::vector<Hash>& roots);
    void sweep_phase();
};

} // namespace vfs::gc
