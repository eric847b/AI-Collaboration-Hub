#include "file_cas_backend.h"
#include "serializer.h"
#include <filesystem>
#include <fstream>

namespace vectorfs {

FileCASBackend::FileCASBackend(const std::string& root)
    : root_(root) {}

bool FileCASBackend::put(const Node& n) {
    std::filesystem::create_directories(root_);

    auto path = root_ + "/" + n.hash.to_string();

    // Use proper serialization instead of memcpy on non-trivially copyable types
    auto serialized = serialize_node(n);

    std::ofstream f(path, std::ios::binary);
    if (!f)
        return false;

    f.write(reinterpret_cast<const char*>(serialized.data()), serialized.size());
    return true;
}

bool FileCASBackend::get(const Hash& h, Node& out) {
    auto path = root_ + "/" + h.to_string();

    std::ifstream f(path, std::ios::binary);
    if (!f)
        return false;

    // Read entire file into buffer, then deserialize properly
    std::vector<uint8_t> buffer((std::istreambuf_iterator<char>(f)),
                                 std::istreambuf_iterator<char>());
    return deserialize_node(buffer, out);
}

bool FileCASBackend::exists(const Hash& h) const {
    auto path = root_ + "/" + h.to_string();
    return std::filesystem::exists(path);
}

}