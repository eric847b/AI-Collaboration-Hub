#include "../branches/branch_ops.h"

using namespace vectorfs;

int main() {

    branch_create("main");
    bool ok = branch_checkout("main");

    return ok ? 0 : 1;
}
