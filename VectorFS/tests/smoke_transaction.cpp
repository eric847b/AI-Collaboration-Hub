#include "../core/transaction.h"
#include "../core/journal.h"

using namespace vectorfs;

int main() {

    Journal j("test.journal");
    TransactionManager tx(j, "test.superblock");

    Node n{};
    tx.add_node(n);
    tx.set_root(n.hash);

    return tx.commit() ? 0 : 1;
}
