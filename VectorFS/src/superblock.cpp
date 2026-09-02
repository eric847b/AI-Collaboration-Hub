#include "superblock.h"
#include <fstream>
#include <cstdio>
#include <chrono>
#include <thread>
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
    
    // Retry the open a few times: on Windows, file creation can transiently fail
    // (ENOENT) when the working directory lives inside a OneDrive "Files On
    // Demand" folder or under real-time antivirus scanning. A short retry loop
    // makes persistence robust there without masking genuine errors.
    std::ofstream out;
    for (int attempt = 0; attempt < 5; ++attempt) {
        out.open(temp_path, std::ios::binary | std::ios::trunc);
        if (out) break;
        std::remove(temp_path.c_str());  // clear any stale/partial file
        out.clear();
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
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
        // Atomic rename for crash safety. POSIX rename() replaces an existing
        // destination, but MSVC's rename() fails if the destination exists —
        // so remove it first (ENOENT is benign here).
        std::remove(path.c_str());
        if (std::rename(temp_path.c_str(), path.c_str()) != 0) {
            std::remove(temp_path.c_str());
            return false;
        }
    } else {
        std::remove(temp_path.c_str());
    }

    return success;
}