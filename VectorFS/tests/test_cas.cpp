#include "cas/cas.h"

#include <cassert>

void test_stores_distinct_nodes_by_distinct_hash() {
    CAS cas;

    Node first = Node::file();
    first.data = {1, 2, 3};

    Node second = Node::file();
    second.data = {4, 5, 6};

    const Hash first_hash = cas.put(first);
    const Hash second_hash = cas.put(second);

    assert(!(first_hash == second_hash));
    assert(cas.get(first_hash).data == first.data);
    assert(cas.get(second_hash).data == second.data);
}

void test_unknown_hash_returns_empty_node() {
    CAS cas;

    Hash missing{};
    missing.b[0] = 0xff;

    const Node result = cas.get(missing);

    assert(result.mode == 0);
    assert(result.data.empty());
    assert(result.children.empty());
    assert(result.dir_entries.empty());
}
