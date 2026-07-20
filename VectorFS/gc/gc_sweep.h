#pragma once
#include <vector>
#include "gc_state.h"
#include "../cas/cas_store.h"

namespace vfs::gc {

void gc_sweep(const ColorMap& color, vfs::CasStore* cas);

} // namespace vfs::gc
