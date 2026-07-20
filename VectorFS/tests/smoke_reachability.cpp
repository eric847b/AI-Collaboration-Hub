#include "../gc/mark.h"
#include "../metadata/metadata_store.h"
#include <vector>
#include <cstdint>

// Define the global metadata pointer referenced by gc/mark.cpp
static MetadataStore g_store;
MetadataStore* g_metadata = &g_store;

int main() {
    // Smoke test: verify mark/sweep can run without crashing
    Mark mark;

    // Run mark with a root inode (inode 0 is typically invalid, but mark handles it)
    mark.run(0);

    // The reachable set should be empty since inode 0 doesn't exist
    const auto& reachable = mark.reachable();

    return reachable.empty() ? 0 : 1;
}
