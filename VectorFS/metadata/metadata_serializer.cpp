#include "metadata_serializer.h"
#include <sstream>

using vfs::DirEntry;

std::string MetadataSerializer::serialize_inode(const Inode& inode) {
    std::stringstream ss;
    ss << inode.id << "|" << (int)inode.type << "|" << inode.size << "|"
       << inode.created << "|" << inode.modified << "|" << inode.cas_ref << "|"
       << inode.symlink_target;
    return ss.str();
}

Inode MetadataSerializer::deserialize_inode(const std::string& data) {
    Inode inode;
    std::stringstream ss(data);
    std::string token;

    std::getline(ss, token, '|'); inode.id = std::stoull(token);
    std::getline(ss, token, '|'); inode.type = (InodeType)std::stoi(token);
    std::getline(ss, token, '|'); inode.size = std::stoull(token);
    std::getline(ss, token, '|'); inode.created = std::stoull(token);
    std::getline(ss, token, '|'); inode.modified = std::stoull(token);
    std::getline(ss, inode.cas_ref, '|');
    std::getline(ss, inode.symlink_target, '|');

    return inode;
}

std::string MetadataSerializer::serialize_dir(const std::vector<DirEntry>& entries) {
    std::stringstream ss;
    for (auto& e : entries) {
        ss << e.name << "," << e.inode_id << "," << e.is_dir << ";";
    }
    return ss.str();
}

std::vector<DirEntry> MetadataSerializer::deserialize_dir(const std::string& data) {
    std::vector<DirEntry> out;
    std::stringstream ss(data);
    std::string item;

    while (std::getline(ss, item, ';')) {
        if (item.empty()) continue;
        std::stringstream row(item);
        std::string name, id, isdir;

        std::getline(row, name, ',');
        std::getline(row, id, ',');
        std::getline(row, isdir, ',');

        out.push_back({name, std::stoull(id), (bool)std::stoi(isdir)});
    }

    return out;
}
