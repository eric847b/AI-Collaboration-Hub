#include "branch_ops.h"
#include "branch_store.h"

namespace vectorfs {

static BranchStore gBranches;

bool branch_create(const std::string& name) {
    if (gBranches.exists(name))
        return false;

    Branch b{};
    b.name = name;

    gBranches.create(b);
    return true;
}

bool branch_checkout(const std::string& name) {
    if (!gBranches.exists(name))
        return false;

    // TODO: implement actual checkout logic (swap working tree to branch state)
    return true;
}

}
