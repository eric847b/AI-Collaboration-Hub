#pragma once
#include "transaction.h"

namespace vectorfs {

class CommitBoundary {
public:
    static bool execute(TransactionManager& tx);
};

}
