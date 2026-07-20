# VectorFS Kernel Specification

## Fundamental Compression

```text
FS        = immutable content graph
Roots     = durable named identities
History   = root transitions
Mount     = active root selection
```

## State Definition

```text
State = last valid superblock + replayable CAS/journal closure
```

## Transaction Boundary

```text
CAS -> Journal -> Root Update -> Superblock Flip
```

## Reachability

```text
LiveSet = closure(all named roots)
```

## Garbage Collection

```text
Dead = CAS - LiveSet
```

## Recovery

```text
Replay(superblock, journal, CAS) -> reconstructed state
```

## Branching

```text
branch = named lineage root
checkout(branch) = activate root
```
