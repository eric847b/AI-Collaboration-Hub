#pragma once

#include <cstdint>
#include <string>
#include <vector>

struct Snapshot {
    std::string root_hash;
    uint64_t timestamp;
};

class SnapshotStore {
public:
    void create_snapshot(const std::string& root_hash);
    std::vector<Snapshot> list_snapshots() const;

private:
    std::vector<Snapshot> snapshots_;
};
