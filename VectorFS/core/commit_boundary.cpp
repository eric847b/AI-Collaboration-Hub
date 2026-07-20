#include "commit_boundary.h"

namespace vectorfs {

bool CommitBoundary::execute(TransactionManager& tx) {
    return tx.commit();
}

}
