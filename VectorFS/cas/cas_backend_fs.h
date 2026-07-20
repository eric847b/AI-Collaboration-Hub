#pragma once
#include "cas_store.h"
#include "../core/node.h"
#include "../core/hash.h"  // Not needed but for safety
#include <string>

class CAS_Backend_FS : public vfs::CasStore {
public:
    CAS_Backend_FS(const std::string& root_path);

    void for_each(const std::function<void(const Hash&)>& fn) const override;
    void erase(const Hash& h) override;

private:
    std::string root;
    std::string path_for(const Hash& h) const;
};