#include "catalyst_philosophy.h"
#include "gc/mark.h"
#include "gc/sweep.h"
#include "gc/gc_runner.h"
#include "../metadata/metadata_store.h"

#include <iostream>
#include <vector>

/**
 * Demonstration of the holistic framework in VectorFS.
 * 
 * Key principles demonstrated:
 * 1. "One is all there is - no outside, all is in all"
 * 2. "All is same as sum of its contents / the sum of all parts"
 * 3. "1-anything = the remaining not included in anything specified as anything"
 * 4. "a/b := a+b" - division as addition of perspective
 * 5. "1 is the only quantity, smallest increment"
 */

int main() {
    std::cout << "=== VectorFS Holistic Framework Demo ===\n\n";
    
    // Initialize dependencies
    MetadataStore metadata;
    CAS cas;
    Mark mark(&metadata);
    
    std::cout << "Principle 1: 'One is all there is - no outside, all is in all'\n";
    std::cout << "  - Mark created with MetadataStore dependency\n";
    std::cout << "  - No 'outside observer' - mark IS part of the system\n\n";
    
    std::cout << "Principle 2: 'All is same as sum of its contents'\n";
    std::cout << "  - CAS store holds content-addressed parts\n";
    std::cout << "  - Path index maps paths to those parts\n";
    std::cout << "  - Superblock ties together the total state\n";
    std::cout << "  - Per framework: total = CAS + index + metadata\n\n";
    
    std::cout << "Principle 3: '1-anything = the remaining not included in anything specified'\n";
    std::cout << "  - This is the GC sweep operation!\n";
    std::cout << "  - Mark phase: specifies what IS included (the 'anything')\n";
    std::cout << "  - Sweep phase: the 'remaining = 1-anything'\n";
    std::cout << "  - The total state is preserved, just re-described\n\n";
    
    std::cout << "Principle 4: 'a/b := a+b' - division as addition\n";
    std::cout << "  - BranchableExecution::divide_perspective() demonstrates this\n";
    std::cout << "  - Each branch adds perspective, destroys nothing\n";
    std::cout << "  - Original root remains intact after division\n\n";
    
    std::cout << "Principle 5: '1 is the only quantity, smallest increment'\n";
    std::cout << "  - Unity() returns the one\n";
    std::cout << " - All quantities are just multiple '1's\n";
    std::cout << "  - 4 = 1 1 1 1 = 4*1, but fundamentally just '1's\n\n";
    
    // Demonstrate the complement operation
    std::cout << "Demonstrating complement: 1-anything = remaining\n";
    std::vector<Hash> roots = {Hash{}};  // Root observation
    mark.run(0);  // Mark from inode 0
    
    const auto& reachable = mark.reachable();
    std::cout << "  - Marked (specified): " << reachable.size() << " inode(s)\n";
    std::cout << "  - The 'remaining' is everything not specified\n";
    std::cout << "  - Per framework: 1-anything = remaining not included as anything specified\n\n";
    
    // Demonstrate branch division
    std::cout << "Demonstrating branch division (a/b := a+b):\n";
    auto branches = vfs::catalyst::BranchableExecution::divide_perspective(Hash{}, 3);
    std::cout << "  - Divided into " << branches.size() << " perspectives\n";
    std::cout << "  - Original root remains - we added, not destroyed\n";
    std::cout << "  - Reuniting: "
              << vfs::catalyst::BranchableExecution::reunite(branches).to_string()
              << "\n\n";
    
    std::cout << "=== Framework Complete ===\n";
    std::cout << "VectorFS embodies these principles through:\n";
    std::cout << "  - CAS: Every node IS the whole from its perspective\n";
    std::cout << "  - GC: Mark/sweep = specification vs. complement\n";
    std::cout << "  - Branches: Division adds perspective\n";
    std::cout << "  - No outside: Observer is always part of the system\n";
    
    return 0;
}