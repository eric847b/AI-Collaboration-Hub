#include "superblock.h"
#include <fstream>
#include <iostream>
#include <cstdio>
#include <ctime>

Superblock::Superblock(CAS& cas) : cas(cas) {}

bool Superblock::resolve(const std::string& path, Hash& out) const {
    auto it = path_index.find(path);
    if (it == path_index.end()) return false;
    out = it->second;
    return true;
}

void Superblock::update_path(const std::string& path, const Hash& h) {
    path_index[path] = h;
}

Hash Superblock::root_hash() const {
    auto it = path_index.find("/");
    if (it == path_index.end()) return Hash{};
    return it->second;
}

/* ---------------------------------------------------------
 * SuperblockAB (serialized form for persistence / recovery)
 * --------------------------------------------------------- */

// Binary format version for forward compatibility
static constexpr uint32_t SUPERBLOCK_MAGIC = 0x56465342; // "VFSB"
static constexpr uint32_t SUPERBLOCK_VERSION = 0x00010000; // v1.0

SuperblockAB SuperblockAB::load(const std::string& path) {
    SuperblockAB sb;
    sb.valid = false;
    
    std::ifstream in(path, std::ios::binary);
    if (!in) {
        return sb;
    }

    // Try to read magic number for format detection
    uint32_t magic = 0;
    in.read(reinterpret_cast<char*>(&magic), sizeof(magic));
    
    bool legacy_format = false;
    if (!in || magic != SUPERBLOCK_MAGIC) {
        // Legacy format: no magic number, seek back to start
        legacy_format = true;
        in.clear();
        in.seekg(0, std::ios::beg);
    }

    uint64_t raw_version = 0;
    
    if (legacy_format) {
        // Legacy: version is 8 bytes, then root hash
        in.read(reinterpret_cast<char*>(&raw_version), sizeof(raw_version));
        uint32_t legacy_version = static_cast<uint32_t>(raw_version);
        sb.version = legacy_version;
    } else {
        // New format: version is 4 bytes
        uint32_t file_version;
        in.read(reinterpret_cast<char*>(&file_version), sizeof(file_version));
        sb.version = file_version;
    }
    
    if (!in) {
        return sb;
    }

    // Read root hash (32 bytes)
    in.read(reinterpret_cast<char*>(sb.root.b.data()), sb.root.b.size());
    if (!in) {
        return sb;
    }

    // Validate root hash is not all zeros (invalid state)
    bool all_zero = true;
    for (auto byte : sb.root.b) {
        if (byte != 0) {
            all_zero = false;
            break;
        }
    }
    
    sb.valid = !all_zero;
    return sb;
}

bool SuperblockAB::save(const std::string& path) const {
    // Atomic write: write to temp file then rename
    std::string temp_path = path + ".tmp";
    
    std::ofstream out(temp_path, std::ios::binary | std::ios::trunc);
    if (!out) {
        return false;
    }

    // Write magic number for format identification
    out.write(reinterpret_cast<const char*>(&SUPERBLOCK_MAGIC), sizeof(SUPERBLOCK_MAGIC));
    
    // Write version
    out.write(reinterpret_cast<const char*>(&SUPERBLOCK_VERSION), sizeof(SUPERBLOCK_VERSION));
    
    // Write root hash
    out.write(reinterpret_cast<const char*>(root.b.data()), root.b.size());

    out.flush();
    bool success = static_cast<bool>(out);
    out.close();

    if (success) {
        // Atomic rename for crash safety
        if (std::rename(temp_path.c_str(), path.c_str()) != 0) {
            std::remove(temp_path.c_str());
            return false;
        }
    } else {
        std::remove(temp_path.c_str());
    }

    return success;
}