#include "cas_backend_mem.h"
#include "hash.h"

std::string CAS_Backend_Mem::put(const Blob& blob) {
    std::string h = Hash::compute(blob.data);
    store[h] = blob;
    return h;
}

bool CAS_Backend_Mem::get(const std::string& hash, Blob& out) {
    if (!store.count(hash)) return false;
    out = store[hash];
    return true;
}

void CAS_Backend_Mem::remove(const std::string& hash) {
    store.erase(hash);
}
