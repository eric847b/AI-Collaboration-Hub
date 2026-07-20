#include "core/node.h"

#include <cassert>
#include <string>

void test_node_basic_construction() {
    const Node dir = Node::directory();
    const Node file = Node::file();

    assert(dir.is_directory());
    assert(!dir.is_file());
    assert(file.is_file());
    assert(!file.is_directory());
}

void test_dir_entry_stores_complete_hash() {
    DirEntry entry;
    entry.name = "child";
    entry.hash.b[0] = 0x42;

    assert(entry.name == "child");
    assert(entry.hash.b[0] == 0x42);
}
