#include "../branches/branch_ops.h"
#include <cassert>
#include <cstdio>
#include <string>

using namespace vectorfs;

static int failures = 0;

static void check(bool cond, const char* what) {
    if (!cond) {
        ++failures;
        std::printf("FAIL: %s\n", what);
    }
}

int main() {
    // checkout before anything exists must fail
    check(!branch_checkout("ghost"), "checkout of nonexistent branch fails");

    // first branch: git-init semantics — created and auto-activated
    check(branch_create("main"), "create main");
    check(branch_current() == "main", "first branch auto-activates");

    // explicit checkout of current branch = successful no-op
    check(branch_checkout("main"), "re-checkout of current branch succeeds");
    check(branch_current() == "main", "current unchanged after re-checkout");

    // second branch seeds from HEAD (root + generation inherited)
    check(branch_create("feature"), "create feature from HEAD");
    check(!branch_create("feature"), "duplicate create rejected");

    // checkout switches the active branch
    check(branch_checkout("feature"), "checkout feature");
    check(branch_current() == "feature", "current switches to feature");

    // back to main
    check(branch_checkout("main"), "checkout main back");
    check(branch_current() == "main", "current switches back to main");

    // unknown branches never become current
    check(!branch_checkout("nope"), "checkout unknown fails");
    check(branch_current() == "main", "failed checkout leaves current intact");

    if (failures != 0) {
        std::printf("%d check(s) failed\n", failures);
        return 1;
    }
    std::printf("branch_checkout: all checks passed\n");
    return 0;
}
