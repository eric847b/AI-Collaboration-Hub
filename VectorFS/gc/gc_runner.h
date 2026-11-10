#pragma once

#include "mark.h"
#include "sweep.h"

class MetadataStore;

class GC_Runner {
public:
    explicit GC_Runner(MetadataStore* metadata);
    void run(uint64_t root_inode);

private:
    Mark mark_;
    Sweep sweep_;
};
