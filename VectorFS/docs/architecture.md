# VectorFS Architecture

## Invariant
Everything orbits **N = {h, c[], d[]}** and **1/2=3**.

## Layers
- core/: Node graph
- cas/: Content-addressed storage
- metadata/: Inode semantics
- fuse/: Surface
- omega-cache/: GPU tier
- snapshots/, clones/: Temporal & branch axes

## Flow
raw bytes → block splitter → CAS graph → inode → FUSE tree → snapshots/clones