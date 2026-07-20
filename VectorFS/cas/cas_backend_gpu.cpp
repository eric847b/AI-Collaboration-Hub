#include "cas_backend_gpu.h"
#include "hash.h"

std::string CAS_Backend_GPU::put(const Blob& blob) {
    std::string h = Hash::compute(blob.data);
    Blob gpu_blob = blob;
    gpu_blob.in_gpu = true;
    gpu_store[h] = gpu_blob;
    return h;
}

bool CAS_Backend_GPU::get(const std::string& hash, Blob& out) {
    if (!gpu_store.count(hash)) return false;
    out = gpu_store[hash];
    return true;
}

void CAS_Backend_GPU::remove(const std::string& hash) {
    gpu_store.erase(hash);
}
