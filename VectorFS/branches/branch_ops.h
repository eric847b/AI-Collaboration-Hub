#pragma once
#include <string>

namespace vectorfs {

bool branch_create(const std::string& name);
bool branch_checkout(const std::string& name);

}
