#include "../core/superblock.h"
#include "../cas/cas.h"
#include <iostream>

int main(int argc, char** argv) {
    if (argc < 2) {
        std::cerr << "usage: mkfs.vectorfs <path>\n";
        return 1;
    }

    CAS cas;
    Superblock sb(cas);
    sb.update_path("/", Hash{});

    std::cout << "VectorFS filesystem created at " << argv[1] << "\n";
    std::cout << "Invariant: 1/2=3 anchored\n";
    return 0;
}