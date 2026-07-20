#include "../core/replay.h"
#include "../core/journal.h"
#include "../core/transaction.h"
#include "../core/node.h"

using namespace vectorfs;

int main() {
    Journal journal("validation.journal");

    TransactionManager tx(journal, "superblock.vfs");

    Node n{};
    n.hash.b[0] = 0x99;

    tx.add_node(n);
    tx.set_root(n.hash);

    if (!tx.commit()) {
        return 1;
    }

    auto replayed = ReplayEngine::replay("validation.journal");

    return replayed.empty() ? 1 : 0;
}
