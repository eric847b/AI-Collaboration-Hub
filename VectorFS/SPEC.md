# VectorFS Specification

## Model

VectorFS is a lineage-oriented cache runtime built on immutable state graphs.

## Primitive Types

### blob
Raw immutable storage page.

### vec
Dependency vector describing relationships between blobs.

### root
Immutable complete state snapshot.

### ref
Mutable selector pointing to active root.

### txn
Atomic transition between roots.

## Invariants

- roots are immutable
- refs are mutable
- transactions are atomic
- no in-place mutation of active state
- lineage is append-only

## GPU Mode

GPU pages are treated as immutable residency nodes.

State transitions:

```txt
allocate
 -> lineage build
 -> freeze root
 -> selector swap
```

## Properties

- deterministic replay
- rollback-safe execution
- branchable runtime state
- temporal deduplication
- residency prediction
- sparse lineage reuse

## Future

- Vulkan backend
- CUDA backend
- WebGPU backend
- tensor graph optimizer
- transactional VRAM scheduler
