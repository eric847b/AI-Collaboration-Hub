# Building VectorFS

## Requirements

- C++20 compiler
- CMake 3.16+
- FUSE development headers (optional, for FUSE binary)

## Suggested Build Layout

```text
mkdir build
cd build
cmake ..
make -j$(nproc)
```

## Build Targets

- `vectorfs` - FUSE filesystem binary (requires FUSE)
- `mkfs.vectorfs` - Filesystem formatter
- `fsck.vectorfs` - Filesystem consistency checker
- `vectorfs_tests` - Unit test suite
- `smoke_transaction` - Transaction smoke test
- `replay_smoke` - Replay smoke test
- `replay_validation` - Replay validation test
- `replay_recovery` - Recovery replay test
- `branch_checkout` - Branch checkout test
- `smoke_reachability` - Reachability smoke test
- `vectorfs_dense` - Dense core binary
- `dense_tests` - Dense core tests

## Runtime Components

- CAS backend (content-addressable storage)
- Journal (append-only transaction log)
- Superblock A/B (dual superblock for crash recovery)
- Replay engine (deterministic state reconstruction)
- Branch subsystem (copy-on-write branching)
- Reachability + liveness (garbage collection)

## Recent Improvements

### High-Value Fixes (Completed)

1. **RecoveryReplay Implementation** - Fixed empty implementation that now properly replays journal entries and updates superblock during crash recovery

2. **CAS Content Hashing** - Improved CAS hash generation to use actual node content instead of trivial counter-based hashes, enabling true content-addressable storage and deduplication

3. **Transaction Atomicity** - Added proper two-phase commit with rollback support to TransactionManager, ensuring atomic state transitions with recovery capability

4. **fsck.vectorfs Enhancement** - Added comprehensive 5-phase filesystem checking:
   - Superblock validation
   - Journal accessibility check
   - Journal entry parsing
   - Recovery replay
   - Root hash verification

5. **SuperblockAB Serialization** - Added magic number, version checking, atomic write with temp file + rename, and legacy format support for crash safety