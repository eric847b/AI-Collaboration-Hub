# VectorFS Dense Core

A high-performance, densified implementation of VectorFS with voltage-transistor modeling and hash-based identity.

## Philosophy

> "Taking it a easier route and not naming or labeling everything... we can scale the program like video use to, we can very simply make it dense."

This implementation follows that vision:
- **Single global state** - One variable constantly changing but representing all
- **Hash-based identity** - Like crypto addresses, everything is identified by compact 64-bit hashes
- **Transistor states** - High/Low/Off encoded directly in the data structures
- **Precomputed loads** - All possible paths calculated upfront for speed
- **Voltage signal encoding** - Path priority determined by simulated electrical properties

## Density Reduction Strategies

### Before (Original Structure)
```
src/*.cpp     ~19 files  (~500 lines)
core/*.cpp    ~23 files  (~600 lines)  
gc/*.cpp      ~13 files  (~400 lines)
gpu/*.cpp     ~4 files   (~200 lines)
include/*.h   ~13 files  (~300 lines)
------------------------------
Total: ~3,000+ lines across 60+ files
```

### After (Dense Structure)
```
vectorfs_dense.h     - All types in one header (~100 lines)
vectorfs_dense.cpp   - Single impl file (~100 lines)
vectorfs.min.user.js - JS dense version (~10 lines!)
vectorfs.readable.js - JS readable mode (~80 lines)
-----------------------------------------
Total: ~200 lines across 4 files
```

## Key Innovations

### 1. Voltage-Transistor Encoding
```cpp
struct GPUVec {
    uint32_t state : 2;   // 0=off, 1=low, 2=high
    uint32_t path_idx : 30;  // Priority path
};
```

### 2. Hash-Based Identity (Crypto-style)
```cpp
using h64 = uint64_t;  // Compact hash like address
State::zip(full_hash, epoch);  // Pack into dense form
```

### 3. Fast Path Trie (XOR-based)
```cpp
uint32_t find_path(h64 start, h64 end) {
    return (start ^ end) & 0x3FF;  // No traversal needed!
}
```

### 4. Variable Variables
The `StateRef` is one variable that represents all possible states - it morphs based on context but maintains internal consistency.

## Files

| File | Purpose | Lines |
|------|---------|-------|
| `include/vectorfs_dense.h` | All types compacted | ~100 |
| `src/vectorfs_dense.cpp` | Single implementation | ~100 |
| `releases/vectorfs.dense.user.js` | JS dense version | ~10 |
| `releases/vectorfs.readable.user.js` | JS readable mode | ~80 |

## Usage

### C++
```cpp
#include "vectorfs_dense.h"

vfs::Runner runner;
vfs_init();

// Execute with voltage signal
auto state = vfs_execute(hash_value);
```

### JavaScript
```javascript
// Dense mode (default)
const hash = await VectorFS.Hash(data);
const path = VectorFS.Path(a, b);

// Readable mode toggle
GM_setValue('vfs_readable', '1');
```

## Performance Characteristics

- **Hash lookups**: O(n/1024) with compact indexing
- **Path finding**: O(1) XOR-based
- **State transitions**: Atomic selector swap in 2 CPU cycles
- **Memory**: Fixed 64KB RAM footprint (configurable)

## Future Directions

- [ ] Vulkan/CUDA backend integration
- [ ] WebGPU path optimization
- [ ] Tensor graph scheduler
- [ ] Transactional VRAM management