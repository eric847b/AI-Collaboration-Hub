#pragma once
#include "cas_store.h"
#include "../core/node.h"
#include <unordered_map>

class CAS_Backend_GPU : public vfs::CasStore {
public:
    void for_each(const std::function<void(const Hash&)>& fn) const override;
    void erase(const Hash& h) override;

private:
    std::unordered_map<Hash, Node, HashHasher> gpu_store;
};