#include "replay.h"
#include <fstream>

namespace vectorfs {

std::vector<ReplayRecord> ReplayEngine::replay(const std::string& path) {
    std::ifstream in(path, std::ios::binary);
    std::vector<ReplayRecord> out;

    if (!in) {
        return out;
    }

    std::string line;

    while (std::getline(in, line)) {
        auto pos = line.find(':');

        if (pos == std::string::npos) {
            continue;
        }

        ReplayRecord r{};

        const auto tag = line.substr(0, pos);
        r.value = line.substr(pos + 1);

        if (tag == "NODE") {
            r.op = JournalOp::NodeWrite;
        } else if (tag == "ROOT") {
            r.op = JournalOp::RootUpdate;
        } else {
            continue;
        }

        out.push_back(r);
    }

    return out;
}

} // namespace vectorfs
