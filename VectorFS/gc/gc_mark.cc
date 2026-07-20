#include "gc_mark.h"

namespace vfs::gc {

void gc_mark(ColorMap& color,
             const std::vector<Hash>& roots,
             vfs::LineageStore* lineage)
{
    std::queue<Hash> worklist;

    // Initialize roots
    for (const auto& r : roots) {
        color[r] = GcColor::Gray;
        worklist.push(r);
    }

    // BFS traversal
    while (!worklist.empty()) {
        Hash h = worklist.front();
        worklist.pop();

        auto children = lineage->children_of(h);

        for (const auto& c : children) {
            if (color[c] == GcColor::White) {
                color[c] = GcColor::Gray;
                worklist.push(c);
            }
        }

        color[h] = GcColor::Black;
    }
}

} // namespace vfs::gc
