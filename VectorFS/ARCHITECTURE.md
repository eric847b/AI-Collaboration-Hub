# VectorFS Architecture

VectorFS is a forward-only transactional content-addressed filesystem.

## Core Model

```text
FS        = immutable content graph
Roots     = durable named identities
History   = root transitions
Mount     = active root selection
```

## Architectural Plates

### core/
- immutable node substrate
- journal ordering
- superblock A/B commit model
- transaction boundary kernel
- recovery replay

### cas/
- content-addressed storage
- durable file CAS backend
- CAS indexing

### metadata/
- directory semantics
- path resolution
- metadata graph projection

### snapshots/
- immutable named roots
- lineage timeline
- generation ancestry

### branches/
- branch lineage
- branch checkout
- root activation

### gc/
- reachability analysis
- incremental liveness tracking

## Core Invariant

Everything mutable collapses to selectors.
Everything durable collapses to immutable roots.

## Transaction Ordering

```text
CAS -> Journal -> Root Update -> Superblock Flip
```

## State Definition

```text
State = last valid superblock + replayable CAS/journal closure
```
