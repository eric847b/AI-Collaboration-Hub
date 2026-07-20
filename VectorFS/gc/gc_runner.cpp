#include "gc_runner.h"
#include "mark.h"
#include "sweep.h"

// Global Mark instance shared between mark and sweep phases
Mark g_mark_instance;
Mark* g_mark = &g_mark_instance;

GC_Runner::GC_Runner() {}

void GC_Runner::run(uint64_t root_inode) {
    mark_phase(root_inode);
    sweep_phase();
}

void GC_Runner::mark_phase(uint64_t root_inode) {
    g_mark_instance.run(root_inode);
}

void GC_Runner::sweep_phase() {
    Sweep sweep;
    sweep.run();
}
