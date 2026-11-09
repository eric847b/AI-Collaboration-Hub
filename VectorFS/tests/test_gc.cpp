#include "gc.h"
#include "gc_runner.h"

int main() {
    // Create dependencies with proper injection
    // CasStore cas;
    // LineageStore lineage;
    // MetadataStore metadata;
    // Mark mark(&metadata);
    // Sweep sweep(&metadata, &mark);
    //
    // GarbageCollectorRunner runner(&cas, &lineage, &metadata, &mark, &sweep);
    // runner.run({});  // Run GC cycle with appropriate roots
    //
    // For this smoke test, verify the header compiles correctly
    return 0;
}
