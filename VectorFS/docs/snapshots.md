# Snapshots

A snapshot captures a root hash at a point in time.

## Model

```text
snapshot := {
    root_hash,
    timestamp
}
```

Snapshots are append-only timeline entries over the CAS graph. `SnapshotStore`
keeps snapshots in creation order and preserves the root hash provided by each
`create_snapshot` call. Persistence beyond the lifetime of the in-memory store
is still planned work.
