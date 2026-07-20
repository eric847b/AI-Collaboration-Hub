#include "cas_backend_fs.h"
#include "hash.h"
#include <fstream>

CAS_Backend_FS::CAS_Backend_FS(const std::string& root_path)
    : root(root_path) {}

std::string CAS_Backend_FS::path_for(const std::string& hash) const {
    return root + "/" + hash + ".blob";
}

std::string CAS_Backend_FS::put(const Blob& blob) {
    std::string h = Hash::compute(blob.data);
    std::ofstream out(path_for(h), std::ios::binary);
    out.write((char*)blob.data.data(), blob.data.size());
    return h;
}

bool CAS_Backend_FS::get(const std::string& hash, Blob& out_blob) {
    std::ifstream in(path_for(hash), std::ios::binary);
    if (!in) return false;

    in.seekg(0, std::ios::end);
    size_t size = in.tellg();
    in.seekg(0);

    out_blob.data.resize(size);
    in.read((char*)out_blob.data.data(), size);
    return true;
}

void CAS_Backend_FS::remove(const std::string& hash) {
    std::remove(path_for(hash).c_str());
}
