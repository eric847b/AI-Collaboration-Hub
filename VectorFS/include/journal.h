#pragma once

#include <cstdint>
#include <string>
#include <vector>

struct JournalEntry {
    std::string operation;
    std::string target;
    uint64_t timestamp;
};

class Journal {
public:
    void append(const JournalEntry& entry);
    std::vector<JournalEntry> entries() const;
};
