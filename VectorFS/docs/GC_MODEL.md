# VectorFS Garbage Collection Model

## Fundamental Rule

```text
LiveSet = closure(all committed roots)
```

## Reachability

All nodes reachable from:
- active superblock root
- snapshots
- branches
- retained lineage roots

are considered live.

## Streaming GC

Streaming GC incrementally:

1. enumerates committed roots
2. computes reachable closure
3. identifies unreachable CAS nodes
4. reclaims dead storage

## Safety Invariant

```text
Committed reachable nodes are never reclaimed.
```

## Transactional Interaction

GC only observes committed superblock generations.
Uncommitted nodes may temporarily exist in CAS.
