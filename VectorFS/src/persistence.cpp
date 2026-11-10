#include "persistence.h"

bool Persistence::load_superblock(Superblock&) {
    return false;
}

bool Persistence::save_superblock(const Superblock&) {
    return true;
}

bool Persistence::write_object(const std::string&,
                               const std::vector<unsigned char>&) {
    return true;
}

bool Persistence::read_object(const std::string&,
                              std::vector<unsigned char>&) {
    return false;
}
