#include "metadata_txn.h"

MetadataTxn::MetadataTxn(MetadataStore* s)
    : store(s), active(false) {}

void MetadataTxn::begin() {
    snapshot = *store;
    active = true;
}

void MetadataTxn::commit() {
    active = false;
}

void MetadataTxn::rollback() {
    if (active) {
        *store = snapshot;
        active = false;
    }
}
