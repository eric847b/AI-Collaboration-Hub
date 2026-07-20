#pragma once
#include "cas.h"
#include <string>

namespace vectorfs {

class FileCASBackend {
public:
    explicit FileCASBackend(const std::string& root);

    bool put(const Node& n);
    bool get(const Hash& h, Node& out);
    bool exists(const Hash& h) const;

private:
    std::string root_;
};

}
