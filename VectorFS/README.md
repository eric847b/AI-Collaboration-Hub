# VectorFS

VectorFS is an experimental content-addressed GPU-aware filesystem runtime built around immutable state graphs, lineage-based caching, and atomic selector swaps.

## Core Concepts

- blob = raw storage or GPU memory page
- vec = dependency vector
- root = immutable system or VRAM state
- ref = mutable selector pointer
- txn = atomic state transition

## Architecture

- CAS layer
- Node graph
- Metadata store
- Immutable roots
- Mutable refs
- Snapshot-ready runtime
- GPU lineage cache model

## Properties

- deterministic replay
- instant rollback
- branchable execution states
- temporal cache lineage
- cross-frame deduplication
- transactional state transitions

## Runtime Flow

```txt
workload
 -> allocate pages
 -> build lineage graph
 -> freeze root
 -> atomic selector swap
```

## Build

```bash
mkdir build
cd build
cmake ..
make
```

## Mount

```bash
./vectorfs <mountpoint>
```
