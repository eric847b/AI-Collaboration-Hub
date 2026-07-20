#include "../core/journal.h"
#include "../core/transaction.h"
#include "../core/node.h"

using namespace vectorfs;

int main() {
    Journal journal("replay.journal");

    TransactionManager tx(journal, "superblock.vfs");

    Node root{};

    root.hash.b[0] = 0x42;

    tx.add_node(root);
    tx.set_root(root.hash);

    return tx.commit() ? 0 : 1;
}
