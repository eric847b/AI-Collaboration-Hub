# VectorFS Failure Model

## Fundamental Principle

A filesystem state only exists at committed superblock boundaries.

Intermediate writes are not considered valid filesystem states.

## Commit Ordering

```text
1. CAS writes
2. Journal append
3. ROOT_UPDATE
4. Superblock A/B flip
```

## Crash Windows

### Before Journal Append
CAS may contain unreachable nodes.
Reachability GC eventually removes them.

### Before ROOT_UPDATE
Journal replay ignores incomplete lineage transitions.

### Before Superblock Flip
Previous superblock remains authoritative.

## Recovery Rule

```text
State = last valid superblock + replayable journal closure
```

## Integrity Rule

Checksums validate:
- superblocks
- serialized nodes
- journal segments

## GC Rule

```text
LiveSet = closure(all committed roots)
Dead    = CAS - LiveSet
```
