#pragma once
#include <vector>
#include "gc_state.h"
#include "../metadata/lineage.h"

namespace vfs::gc {

void gc_mark(ColorMap& color,
             const std::vector<Hash>& roots,
             vfs::LineageStore* lineage);

} // namespace vfs::gc
