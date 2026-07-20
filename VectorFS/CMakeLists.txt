cmake_minimum_required(VERSION 3.16)
project(VectorFS LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

option(VECTORFS_BUILD_FUSE "Build the FUSE vectorfs binary" ON)
option(VECTORFS_BUILD_TESTS "Build VectorFS unit tests" ON)

# ---- Common library sources used by multiple targets ----
set(VECTORFS_CORE_SOURCES
    src/cas.cpp
    src/superblock.cpp
    src/snapshot.cpp
    src/hash.cpp
    src/block_splitter.cpp
    src/directory_codec.cpp
    src/inode_table.cpp
    src/clone.cpp
    src/gc.cpp
    src/persistence.cpp
    src/node.cpp
)

set(VECTORFS_INCLUDE_DIRS
    .
    include
    core
    cas
    src
    fuse
    metadata
    branches
    gc
)

# ---- FUSE binary ----
if(VECTORFS_BUILD_FUSE)
    find_package(PkgConfig QUIET)
    if(PkgConfig_FOUND)
        pkg_check_modules(FUSE QUIET fuse3)
        if(NOT FUSE_FOUND)
            pkg_check_modules(FUSE QUIET fuse)
        endif()
    endif()

    if(FUSE_FOUND)
        add_executable(vectorfs
            fuse/vectorfs.cpp
            src/fuse_ops.cpp
            src/metadata_store.cpp
            ${VECTORFS_CORE_SOURCES}
        )
        target_include_directories(vectorfs PRIVATE
            ${VECTORFS_INCLUDE_DIRS}
            ${FUSE_INCLUDE_DIRS}
        )
        target_link_libraries(vectorfs PRIVATE ${FUSE_LIBRARIES})
        target_compile_options(vectorfs PRIVATE ${FUSE_CFLAGS_OTHER})
    else()
        message(WARNING "FUSE development files were not found; skipping vectorfs binary")
    endif()
endif()

# ---- Unit tests ----
if(VECTORFS_BUILD_TESTS)
    enable_testing()

    # Main unit test binary
    add_executable(vectorfs_tests
        src/cas.cpp
        src/snapshot.cpp
        src/hash.cpp
        tests/test_cas.cpp
        tests/test_node.cpp
        tests/test_snapshot.cpp
        tests/test_main.cpp
    )
    target_include_directories(vectorfs_tests PRIVATE
        .
        include
        cas
        core
    )
    add_test(NAME VectorFSTests COMMAND vectorfs_tests)

    # Transaction smoke test
    add_executable(smoke_transaction
        core/journal.cpp
        tests/smoke_transaction.cpp
    )
    target_include_directories(smoke_transaction PRIVATE
        .
        core
        include
    )
    add_test(NAME SmokeTransaction COMMAND smoke_transaction)

    # Replay smoke test
    add_executable(replay_smoke
        core/journal.cpp
        core/replay.cpp
        tests/replay_smoke.cpp
    )
    target_include_directories(replay_smoke PRIVATE
        .
        core
        include
    )
    add_test(NAME ReplaySmoke COMMAND replay_smoke)

    # Replay validation test
    add_executable(replay_validation
        core/journal.cpp
        core/replay.cpp
        tests/replay_validation.cpp
    )
    target_include_directories(replay_validation PRIVATE
        .
        core
        include
    )
    add_test(NAME ReplayValidation COMMAND replay_validation)

    # Recovery replay test
    add_executable(replay_recovery
        core/journal.cpp
        core/recovery_replay.cpp
        src/superblock.cpp
        src/cas.cpp
        tests/replay_recovery.cpp
    )
    target_include_directories(replay_recovery PRIVATE
        .
        core
        cas
        include
        src
    )
    add_test(NAME ReplayRecovery COMMAND replay_recovery)

    # Branch checkout test
    add_executable(branch_checkout
        branches/branch_ops.cpp
        branches/branch_store.cpp
        tests/branch_checkout.cpp
    )
    target_include_directories(branch_checkout PRIVATE
        .
        core
        branches
        include
    )
    add_test(NAME BranchCheckout COMMAND branch_checkout)

    # Reachability smoke test (requires metadata store)
    add_executable(smoke_reachability
        gc/mark.cpp
        metadata/metadata_store.cpp
        metadata/metadata_gc.cpp
        tests/smoke_reachability.cpp
    )
    target_include_directories(smoke_reachability PRIVATE
        .
        core
        metadata
        include
    )
    add_test(NAME SmokeReachability COMMAND smoke_reachability)
endif()

# ---- Dense Core Target ----
add_executable(vectorfs_dense
    src/vectorfs_dense.cpp
)
target_include_directories(vectorfs_dense PRIVATE include core)

# ---- Dense Core Tests ----
add_executable(dense_tests
    tests/test_dense.cpp
)
target_include_directories(dense_tests PRIVATE include core)
add_test(NAME DenseCoreTests COMMAND dense_tests)

# ---- Utility tools ----
add_executable(mkfs.vectorfs
    mkfs/mkfs.vectorfs.cpp
    src/superblock.cpp
    src/cas.cpp
    src/hash.cpp
)
target_include_directories(mkfs.vectorfs PRIVATE
    .
    core
    cas
    include
    src
)

add_executable(fsck.vectorfs
    tools/fsck.vectorfs.cpp
    core/recovery_replay.cpp
    core/journal.cpp
    src/superblock.cpp
    src/cas.cpp
    src/hash.cpp
)
target_include_directories(fsck.vectorfs PRIVATE
    .
    core
    cas
    include
    src
)
