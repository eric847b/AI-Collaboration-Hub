#pragma once
#include <cstdint>
#include <cstddef>

namespace vectorfs {

uint64_t checksum64(const void* data, size_t len);

}
