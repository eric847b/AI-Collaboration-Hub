#pragma once
#include <string>
#include <cstdint>
#include <vector>

namespace vectorfs {

enum class JournalOp {
    NodeWrite,
    RootUpdate
};

struct JournalEntry {
    JournalOp op;
    std::string hash;
};

class Journal {
    std::string path_;

public:
    explicit Journal(const std::string& path);

    bool append(const JournalEntry& e);
    std::vector<JournalEntry> entries() const;
    
    const std::string& path() const { return path_; }
};

} // namespace vectorfs