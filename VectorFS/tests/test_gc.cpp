#include "gc.h"

int main() {
    GarbageCollector gc;
    gc.mark_from_root("root");
    gc.sweep();
    return 0;
}
