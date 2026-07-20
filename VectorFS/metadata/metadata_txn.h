#pragma once
#include "metadata_store.h"

class MetadataTxn {
public:
    MetadataTxn(MetadataStore* store);

    void begin();
    void commit();
    void rollback();

private:
    MetadataStore* store;
    MetadataStore snapshot;
    bool active;
};
