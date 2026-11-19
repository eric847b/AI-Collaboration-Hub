#pragma once
#include <unordered_set>

class Mark;
class MetadataStore;

class Sweep {
public:
    explicit Sweep(Mark* mark);

    void run();

private:
    Mark* mark_;
    void sweep_unreachable();
};
