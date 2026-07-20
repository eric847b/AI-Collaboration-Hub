#pragma once
#include <cstdint>

class GC_Runner {
public:
    GC_Runner();

    void run(uint64_t root_inode);

private:
    void mark_phase(uint64_t root_inode);
    void sweep_phase();
};
