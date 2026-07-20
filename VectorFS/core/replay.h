#pragma once
#include "journal.h"
#include <string>
#include <vector>

namespace vectorfs {

struct ReplayRecord {
    JournalOp op;
    std::string value;
};

class ReplayEngine {
public:
    static std::vector<ReplayRecord> replay(const std::string& path);
};

} // namespace vectorfs
