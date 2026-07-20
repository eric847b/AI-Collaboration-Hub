#include "journal.h"
#include <fstream>
#include <sstream>

namespace vectorfs {

static const char* op_name(JournalOp op) {
    switch (op) {
        case JournalOp::NodeWrite: return "NODE";
        case JournalOp::RootUpdate: return "ROOT";
        default: return "UNKNOWN";
    }
}

static JournalOp op_from_name(const std::string& name) {
    if (name == "NODE") return JournalOp::NodeWrite;
    if (name == "ROOT") return JournalOp::RootUpdate;
    return JournalOp::RootUpdate;
}

Journal::Journal(const std::string& path)
    : path_(path) {}

bool Journal::append(const JournalEntry& e) {
    std::ofstream out(path_, std::ios::app | std::ios::binary);
    if (!out) {
        return false;
    }

    out << op_name(e.op) << ':' << e.hash << '\n';
    out.flush();

    return static_cast<bool>(out);
}

std::vector<JournalEntry> Journal::entries() const {
    std::vector<JournalEntry> result;
    std::ifstream in(path_);
    if (!in) return result;

    std::string line;
    while (std::getline(in, line)) {
        auto sep = line.find(':');
        if (sep == std::string::npos) continue;

        JournalEntry e;
        e.op = op_from_name(line.substr(0, sep));
        e.hash = line.substr(sep + 1);
        result.push_back(e);
    }
    return result;
}

} // namespace vectorfs
