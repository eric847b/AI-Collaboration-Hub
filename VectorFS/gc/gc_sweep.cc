#include "gc_sweep.h"

namespace vfs::gc {

void gc_sweep(const ColorMap& color, vfs::CasStore* cas) {
    std::vector<Hash> to_delete;

    cas->for_each([&](const Hash& h) {
        auto it = color.find(h);
        if (it == color.end() || it->second == GcColor::White) {
            to_delete.push_back(h);
        }
    });

    for (const auto& h : to_delete) {
        cas->erase(h);
    }
}

} // namespace vfs::gc
