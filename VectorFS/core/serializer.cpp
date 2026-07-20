#include "serializer.h"
#include <cstring>
#include <algorithm>

namespace vectorfs {

// Helper: write a value in little-endian byte order
template<typename T>
static void write_val(std::vector<uint8_t>& buf, T val) {
    for (size_t i = 0; i < sizeof(T); ++i) {
        buf.push_back(static_cast<uint8_t>((val >> (i * 8)) & 0xFF));
    }
}

// Helper: read a value in little-endian byte order
template<typename T>
static bool read_val(const std::vector<uint8_t>& b, size_t& offset, T& out) {
    if (offset + sizeof(T) > b.size()) return false;
    out = 0;
    for (size_t i = 0; i < sizeof(T); ++i) {
        out |= static_cast<T>(b[offset + i]) << (i * 8);
    }
    offset += sizeof(T);
    return true;
}

// Helper: write raw bytes
static void write_bytes(std::vector<uint8_t>& buf, const uint8_t* data, size_t len) {
    buf.insert(buf.end(), data, data + len);
}

// Helper: read raw bytes
static bool read_bytes(const std::vector<uint8_t>& b, size_t& offset, uint8_t* out, size_t len) {
    if (offset + len > b.size()) return false;
    std::memcpy(out, b.data() + offset, len);
    offset += len;
    return true;
}

std::vector<uint8_t> serialize_node(const Node& n) {
    std::vector<uint8_t> buf;
    buf.reserve(256);

    // Magic: "VFSN"
    buf.insert(buf.end(), {'V', 'F', 'S', 'N'});
    // Version
    write_val<uint32_t>(buf, 1);

    // Hash (32 bytes)
    write_bytes(buf, n.hash.b.data(), 32);

    // mode
    write_val<uint64_t>(buf, static_cast<uint64_t>(n.mode));

    // data: length + bytes
    write_val<uint64_t>(buf, n.data.size());
    write_bytes(buf, n.data.data(), n.data.size());

    // children: count + hashes
    write_val<uint64_t>(buf, n.children.size());
    for (const auto& child : n.children) {
        write_bytes(buf, child.b.data(), 32);
    }

    // dir_entries: count + entries
    write_val<uint64_t>(buf, n.dir_entries.size());
    for (const auto& entry : n.dir_entries) {
        // name: length + string data
        write_val<uint64_t>(buf, entry.name.size());
        buf.insert(buf.end(), entry.name.begin(), entry.name.end());
        // hash
        write_bytes(buf, entry.hash.b.data(), 32);
    }

    return buf;
}

bool deserialize_node(const std::vector<uint8_t>& b, Node& out) {
    size_t offset = 0;

    // Magic check
    if (b.size() < 4) return false;
    if (b[0] != 'V' || b[1] != 'F' || b[2] != 'S' || b[3] != 'N') return false;
    offset = 4;

    // Version
    uint32_t version = 0;
    if (!read_val(b, offset, version)) return false;
    if (version != 1) return false;

    // Hash
    if (!read_bytes(b, offset, out.hash.b.data(), 32)) return false;

    // mode
    uint64_t mode_val = 0;
    if (!read_val(b, offset, mode_val)) return false;
    out.mode = static_cast<mode_t>(mode_val);

    // data
    uint64_t data_len = 0;
    if (!read_val(b, offset, data_len)) return false;
    if (offset + data_len > b.size()) return false;
    out.data.resize(data_len);
    if (data_len > 0) {
        if (!read_bytes(b, offset, out.data.data(), data_len)) return false;
    }

    // children
    uint64_t num_children = 0;
    if (!read_val(b, offset, num_children)) return false;
    out.children.resize(num_children);
    for (uint64_t i = 0; i < num_children; ++i) {
        if (!read_bytes(b, offset, out.children[i].b.data(), 32)) return false;
    }

    // dir_entries
    uint64_t num_entries = 0;
    if (!read_val(b, offset, num_entries)) return false;
    out.dir_entries.resize(num_entries);
    for (uint64_t i = 0; i < num_entries; ++i) {
        uint64_t name_len = 0;
        if (!read_val(b, offset, name_len)) return false;
        if (offset + name_len > b.size()) return false;
        out.dir_entries[i].name.assign(
            reinterpret_cast<const char*>(b.data() + offset), name_len);
        offset += name_len;
        if (!read_bytes(b, offset, out.dir_entries[i].hash.b.data(), 32)) return false;
    }

    return true;
}

}
