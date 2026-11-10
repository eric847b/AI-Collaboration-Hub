#pragma once
#include <unordered_set>

class Mark;
class MetadataStore;

class Sweep {
public:
    Sweep(MetadataStore* metadata, Mark* mark);

    void run();

private:
    MetadataStore* metadata_;
    Mark* mark_;
    void sweep_unreachable();
};
