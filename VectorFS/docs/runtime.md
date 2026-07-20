# VectorFS Runtime

## Model

Everything mutable collapses into refs.
Everything durable collapses into immutable roots.

## Runtime

```txt
mutation
 -> txn
 -> immutable snapshot
 -> lineage append
 -> atomic swap
```

## Core Runtime Objects

- ROOTS
- REFS
- TXNS
- LINEAGE
- BLOBS

## Capabilities

- deterministic replay
- rollback
- lineage persistence
- transactional execution
- browser runtime virtualization

## Releases

- vectorfs.user.js
- vectorfs.min.user.js
- vectorfs.kernel.user.js

## Future

- wasm scheduler
- gpu compute graph
- binary delta encoding
- distributed lineage replication
- immutable module graphs
