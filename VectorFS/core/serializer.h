#pragma once
#include "node.h"
#include <vector>
#include <cstdint>

namespace vectorfs {

std::vector<uint8_t> serialize_node(const Node& n);
bool deserialize_node(const std::vector<uint8_t>& b, Node& out);

}
