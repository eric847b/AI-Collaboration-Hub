#include "node.h"
#include <sstream>
#include <iomanip>

namespace vectorfs {

std::string to_string(const Hash& h) {
    std::ostringstream oss;

    for (size_t i = 0; i < h.b.size(); i++) {
        oss << std::hex
            << std::setw(2)
            << std::setfill('0')
            << (int)h.b[i];
    }

    return oss.str();
}

// operator== is already defined as a member function in core/node.h

} // namespace vectorfs