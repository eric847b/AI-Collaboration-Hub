#pragma once
#include "cas_store.h"
#include <unordered_map>

class CAS_Backend_Mem : public CAS_Store {
public:
    std::string put(const Blob& blob) override;
    bool get(const std::string& hash, Blob& out) override;
    void remove(const std::string& hash) override;

private:
    std::unordered_map<std::string, Blob> store;
};
