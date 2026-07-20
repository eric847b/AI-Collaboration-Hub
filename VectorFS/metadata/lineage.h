#pragma once
#include <vector>
#include "../core/node.h"

namespace vfs {

// Interface for querying the parent-child lineage of CAS nodes.
// This is used by the GC mark phase to traverse the object graph.
class LineageStore {
public:
    virtual ~LineageStore() = default;

    // Return the hashes of all children referenced by the node at hash h.
    virtual std::vector<Hash> children_of(const Hash& h) const = 0;

    // Return all known root hashes.
    virtual std::vector<Hash> roots() const = 0;
};

} // namespace vfs