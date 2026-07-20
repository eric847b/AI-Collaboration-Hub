# VectorFS Triage Tasks

This triage pass proposes four focused follow-up tasks: one typo fix, one bug fix,
one documentation/comment discrepancy fix, and one test improvement.

## 1. Typo fix: normalize the GPU CAS backend source filename

**Task:** Rename `cas/cas_backend_gpu.cpp cpp` to `cas/cas_backend_gpu.cpp` and update any
build scripts or references that should compile the GPU CAS backend.

**Why:** The tracked source filename contains an extra ` cpp` suffix, which looks like a
filename typo and makes the file easy to miss in build tooling, editor file globs, and
source lists.

**Suggested acceptance criteria:**
- The file is renamed to `cas/cas_backend_gpu.cpp`.
- Any CMake/source-list references use the corrected filename.
- A clean `git ls-files 'cas/*gpu*'` shows only the expected `.cpp` and `.h` GPU backend files.

## 2. Bug fix: make `DirEntry` use a complete `Hash` type

**Task:** Move the `Hash` definition into a shared header that `core/node.h` can include, or
change `DirEntry` to store a type that is complete at the point of declaration.

**Why:** `core/node.h` forward-declares `struct Hash` and then stores `Hash` by value in
`DirEntry`. C++ requires a complete type for a by-value data member, so including this
header by itself can fail to compile. The concrete `Hash` definition currently lives in
`cas/cas.h`, after that header includes `node.h`, which also creates a circular ownership
relationship between the node and CAS layers.

**Suggested acceptance criteria:**
- `core/node.h` can be compiled when included directly in a minimal translation unit.
- The CAS layer and tests include the same canonical `Hash` definition.
- The node/CAS include dependency is acyclic.

## 3. Documentation discrepancy fix: align snapshot docs with implementation status

**Task:** Either implement append-only snapshot storage in `SnapshotStore`, or update
`docs/snapshots.md` to explicitly mark append-only snapshots as planned rather than current
behavior.

**Why:** The snapshot documentation describes snapshots as append-only timeline entries, but
`SnapshotStore::create_snapshot` currently discards its root hash argument and
`SnapshotStore::list_snapshots` always returns an empty vector. The docs therefore describe
behavior that the current code does not provide.

**Suggested acceptance criteria:**
- If implementing behavior: creating two snapshots returns both snapshots in creation order,
  with their root hashes preserved.
- If documenting status: the snapshot model clearly distinguishes current stubs from planned
  append-only persistence.
- A regression test or documentation note covers the chosen behavior.

## 4. Test improvement: replace placeholder CAS hashing test with behavioral assertions

**Task:** Expand `tests/test_cas.cpp` so it exercises real CAS behavior instead of only
asserting `EXPECT_TRUE(true)`.

**Why:** The current CAS test is a placeholder and does not verify hashing, storage,
retrieval, or collision behavior. A useful first test should insert distinct nodes into
`CAS`, assert their hashes differ, retrieve each node by hash, and verify missing hashes
follow the intended error/empty behavior once that contract is defined.

**Suggested acceptance criteria:**
- The test fails if `CAS::put` returns the same hash for two distinct nodes.
- The test fails if `CAS::get` cannot retrieve a previously inserted node.
- The test documents the expected behavior for unknown hashes.
