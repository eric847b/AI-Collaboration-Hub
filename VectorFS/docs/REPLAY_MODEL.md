# VectorFS Replay Model

## Purpose

Replay reconstructs deterministic filesystem state from:

- superblock
- journal
- CAS

## Replay Cursor

Replay progresses through ordered journal generations.

```text
ReplayCursor {
    generation
    offset
}
```

## Replay Rules

1. load newest valid superblock
2. restore root selector
3. replay ordered journal entries
4. reconstruct reachable graph closure
5. expose resulting root as mounted state

## Invariant

```text
Replay(superblock, journal, CAS) -> deterministic state
```
