#pragma once

#include "../core/node.h"
#include <vector>
#include <string>

// Compute a hash digest of raw bytes and return as a hex string.
std::string hash_bytes(const std::vector<unsigned char>& data);

// Compute a hash digest of raw bytes and return as a Hash struct.
Hash hash_bytes_raw(const std::vector<unsigned char>& data);