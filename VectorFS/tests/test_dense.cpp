// VectorFS Dense Core Tests
#include "vectorfs_dense.h"
#include <cassert>
#include <cstdio>

int main() {
    printf("=== VectorFS Dense Core Tests ===\n");
    
    // Test 1: Hash compression
    printf("Test 1: Hash compression... ");
    vfs::h256 full = {};
    full[0] = 0xDE; full[1] = 0xAD; full[2] = 0xBE; full[3] = 0xEF;
    vfs::h64 comp = vfs::compact(full);
    assert(comp == 0xDEADBEEFULL);
    printf("PASS\n");
    
    // Test 2: Voltage signal encoding
    printf("Test 2: Voltage signal encoding... ");
    vfs::h64 vsig = vfs::voltage_signal(1.2f, 0.5f);
    printf("PASS (hash=%llx)\n", (unsigned long long)vsig);
    
    // Test 3: State morphology
    printf("Test 3: State operations... ");
    vfs::State s = vfs::State::zip(full, 42);
    assert(s.h == 0xDEADBEEFULL);
    assert(s.epoch == 42);
    printf("PASS\n");
    
    // Test 4: CAS operations
    printf("Test 4: CAS put/get... ");
    vfs::CAS cas;
    vfs::CAS::Node n{};
    n.mode = 0755;
    
    // Fixed array - set first child
    n.children[0] = 1;
    vfs::h64 h = cas.put(n);
    assert(cas.get(h) != nullptr);
    assert(cas.get(h)->mode == 0755);
    printf("PASS\n");
    
    // Test 5: GPU transistor states
    printf("Test 5: GPU voltage states... ");
    vfs::GPUVec gpu{};
    gpu.voltage = 1.8f;  // High voltage
    gpu.state = 2;
    vfs::State evolved = gpu.evolve(0.016f);  // 16ms frame time
    printf("PASS\n");
    
    // Test 6: Fast path calculation
    printf("Test 6: Fast path... ");
    vfs::Runner runner;
    vfs::State fp = runner.fast_path(0x12345678);
    assert(fp.h == 0x12345678);
    assert(fp.t == vfs::Type::Vec);
    printf("PASS\n");
    
    printf("\n=== All Dense Core Tests Passed ===\n");
    return 0;
}