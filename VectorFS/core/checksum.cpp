#include "checksum.h"

namespace vectorfs {

uint64_t checksum64(const void* data, size_t len) {

    const uint8_t* p = reinterpret_cast<const uint8_t*>(data);
    uint64_t h = 1469598103934665603ULL;

    for (size_t i = 0; i < len; ++i) {
        h ^= p[i];
        h *= 1099511628211ULL;
    }

    return h;
}

}
