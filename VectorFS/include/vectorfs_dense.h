// VectorFS Dense Core - Single Header Implementation
#pragma once

#include <array>
#include <cstdint>
#include <cstring>

namespace vfs {
// === Compact types ===
using h64 = uint64_t;   // 64-bit hash (truncated for density)
using h256 = std::array<uint8_t, 32>;  // Full hash when needed

enum class Type : uint8_t { Invalid=0, Blob=1, Vec=2, Root=3, Node=4 };

struct State {
    h64 h;  // Compact hash
    uint32_t epoch;
    Type t : 4;
    uint8_t flags : 4;
    
    static State zip(const h256& full, uint64_t e) {
        State s{};
        s.h = *reinterpret_cast<const h64*>(full.data());
        s.epoch = e;
        return s;
    }
};

// === CAS + Cache merged ===
struct CAS {
    struct Node {
        h64 h;
        uint32_t mode;
        uint32_t pad;
        uint32_t children[8];  // Fixed array for speed
    };
    
    static constexpr size_t CAP = 4096;
    Node store[CAP];
    h64 index[CAP];
    uint32_t count = 0;
    
    h64 put(const Node& n) {
        h64 h = hash64(n);
        if (count < CAP) {
            index[count] = h;
            store[count] = n;
            store[count].h = h;
            ++count;
        }
        return h;
    }
    
    Node* get(h64 h) {
        for (uint32_t i = 0; i < count; ++i) {
            if (index[i] == h) return &store[i];
        }
        return nullptr;
    }
    
private:
    h64 hash64(const Node& n) {
        uint64_t v = 0xcbf29ce48dd0e300;
        for (size_t i = 0; i < sizeof(Node); ++i) {
            v ^= reinterpret_cast<const uint8_t*>(&n)[i];
            v *= 0x100000001b3ULL;
        }
        return v;
    }
};

// === GPU VectorFS ===
struct GPUVec {
    h64 id;
    float voltage;   // Actual voltage simulation
    float current;   // Current draw
    uint32_t state : 2;  // 0=off, 1=low, 2=high
    uint32_t path_idx : 30;
    
    State evolve(float dt) {
        current = voltage * (state + 1) * 0.1f;
        return State::zip(h256{}, path_idx);
    }
};

// === Fast dispatch ===
struct Runner {
    CAS cas;
    State selector;
    GPUVec gpu[64];
    
    inline void exec(h64 pc, auto&& fn) {
        if (pc < 1000) {  // Fast path check
            fn(pc & 0xF);  // Dispatch to 16 handlers
        }
    }
    
    inline State fast_path(h64 start) {
        State s{};
        s.h = start;
        s.t = Type::Vec;
        return s;
    }
};

// === Hash compression utility ===
inline h64 compact(const h256& full) {
    return *reinterpret_cast<const h64*>(full.data());
}

// === Voltage signal encoding ===
inline h64 voltage_signal(float v, float i) {
    union { float f[2]; h64 h; } conv{v, i};
    return conv.h;
}

} // namespace vfs

// === Single global instance ===
static vfs::Runner* vfs_ptr = nullptr;