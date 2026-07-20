# VectorFS Canonical Model

## Core Invariants

VectorFS is built around immutable object storage.

Everything durable is content-addressed.
Everything mutable collapses to a selector.

## Canonical Object Graph

```text
root_selector
    ↓
commit
    ↓
manifest
    ↓
objects
```

## Primitive Types

### OBJECT
Immutable binary payload.

### HASH
Deterministic content address.

### COMMIT
Transaction boundary describing a filesystem state.

### ROOT
Named lineage entrypoint.

### SELECTOR
Single mutable pointer to the current root.

### SNAPSHOT
Recoverable immutable state.

## Transaction Model

```text
BEGIN
  stage objects
  build manifest
  verify hashes
  allocate lineage root
COMMIT
  atomically swap selector
END
```

## Design Goals

- deterministic replay
- append-only durability
- atomic commit boundaries
- rollback safety
- distributed lineage compatibility
- snapshot-first restoration
- scalable chunk deduplication
- GPU attachable execution

## Long-Term Direction

VectorFS converges concepts from:

- Git
- ZFS
- IPFS
- OCI image layers
- distributed DAG execution systems

while preserving a minimal immutable ontology.
