#pragma once
#include <unordered_set>

class Sweep {
public:
    Sweep();

    void run();

private:
    void sweep_unreachable();
};
