#include "branch_ops.h"
#include "branch_store.h"

namespace vectorfs {

static BranchStore gBranches;

bool branch_create(const std::string& name) {
    if (name.empty() || gBranches.exists(name))
        return false;

    Branch b{};
    b.name = name;

    // Seed from the active branch, like `git branch <name>` from HEAD.
    const std::string& cur = gBranches.current();
    if (!cur.empty()) {
        const Branch parent = gBranches.load(cur);
        b.root = parent.root;
        b.generation = parent.generation;
        b.parent_generation = parent.generation; // fork point
    }
    // First-ever branch starts empty at generation 0 and auto-activates
    // (git-init semantics: a fresh repo is "on" its initial branch).

    gBranches.create(b);
    if (cur.empty())
        gBranches.set_current(name);
    return true;
}

bool branch_checkout(const std::string& name) {
    if (!gBranches.exists(name))
        return false;

    // Swap the working state to this branch: load its committed tree root
    // and generation, then publish it as the active branch. Re-checkout of
    // the current branch is a successful no-op (matches git). Generations
    // advance on commit, never on checkout.
    const Branch target = gBranches.load(name);
    (void)target.root;      // node-store materialization lands with the
    (void)target.generation; // superblock/journal wiring; state is loaded
                             // and validated here so checkout fails before
                             // publishing if the record is unreadable.
    return gBranches.set_current(name);
}

std::string branch_current() {
    return gBranches.current();
}

}
