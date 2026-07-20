#pragma once
#include <functional>
#include "../core/node.h"

namespace vfs {

// Interface for CAS storage operations used by GC sweep.
class CasStore {
public:
    virtual ~CasStore() = default;

    // Iterate over all stored hashes.
    virtual void for_each(const std::function<void(const Hash&)>& fn) const = 0;

    // Erase a node by hash.
    virtual void erase(const Hash& h) = 0;
};

} // namespace vfs