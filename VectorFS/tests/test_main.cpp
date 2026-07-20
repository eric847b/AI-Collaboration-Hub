void test_stores_distinct_nodes_by_distinct_hash();
void test_unknown_hash_returns_empty_node();
void test_node_basic_construction();
void test_dir_entry_stores_complete_hash();
void test_lists_snapshots_in_creation_order();

int main() {
    test_stores_distinct_nodes_by_distinct_hash();
    test_unknown_hash_returns_empty_node();
    test_node_basic_construction();
    test_dir_entry_stores_complete_hash();
    test_lists_snapshots_in_creation_order();
    return 0;
}
