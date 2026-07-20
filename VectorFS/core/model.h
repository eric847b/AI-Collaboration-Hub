#pragma once

#include <stdint.h>

typedef struct{uint64_t id,size,flags;}vfs_blob;
typedef struct{uint64_t id,parent,count;}vfs_vec;
typedef struct{uint64_t id,vec,epoch;}vfs_root;
typedef struct{uint64_t active,previous;}vfs_ref;
typedef struct{uint64_t from,to,state;}vfs_txn;
