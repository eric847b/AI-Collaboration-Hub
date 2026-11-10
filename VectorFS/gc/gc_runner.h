#pragma once

#include "mark.h"

class MetadataStore;

class GC_Runner {
public:
    explicit GC_Runner(MetadataStore* metadata);
    void run(uint64_t root_inode);

private:
    Mark mark_;
};
