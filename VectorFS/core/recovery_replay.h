#pragma once
#include "journal.h"
#include "superblock.h"

namespace vectorfs {

class RecoveryReplay {
public:
    static bool replay(const std::string& journal_path,
                       const std::string& superblock_path);
};

}
