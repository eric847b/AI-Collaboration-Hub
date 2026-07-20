#pragma once
#include "cas.h"
#include <unordered_map>
#include <string>

namespace vectorfs {

class CASIndex {
public:
    void insert(const Hash& h, const std::string& path);
    bool lookup(const Hash& h, std::string& out) const;

private:
    std::unordered_map<std::string,std::string> index_;
};

}
