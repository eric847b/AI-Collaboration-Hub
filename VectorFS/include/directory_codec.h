#pragma once

#include "../core/node.h"
#include <string>
#include <vector>

// Encode a list of DirEntry (with Hash) into a flat byte buffer.
std::vector<unsigned char> encode_directory(const std::vector<DirEntry>& entries);

// Decode a flat byte buffer back into a list of DirEntry.
std::vector<DirEntry> decode_directory(const std::vector<unsigned char>& data);