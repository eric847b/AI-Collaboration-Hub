#include "gc/mark.h"
#include "metadata/metadata_store.h"

int main() {
    MetadataStore store;
    Mark mark(&store);
    mark.run(0);

    return mark.reachable().count(0) == 1 && store.get_inodes().empty() ? 0 : 1;
}
