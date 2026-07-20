# VectorFS Roadmap

## Current State

VectorFS now contains the complete architectural spine for:

- immutable content graph
- durable CAS
- transaction boundaries
- journal replay
- snapshots and branches
- reachability and liveness
- recovery replay

## Remaining Runtime Work

### Correctness
- journal checksum validation
- deterministic replay ordering
- superblock generation rigor
- transactional rollback windows

### Storage
- compact binary encoding
- segmented CAS layout
- compaction strategy
- streaming GC

### Runtime
- full FUSE integration
- mount orchestration
- concurrent transaction scheduling
- lock refinement

### Reliability
- fuzz testing
- corruption injection tests
- replay consistency verification
- crash simulation harnesses

### Performance
- incremental reachability
- CAS dedup acceleration
- caching layers
- async commit batching
