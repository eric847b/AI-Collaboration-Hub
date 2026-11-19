# Merge Policy — Always Mergeable Trunk

**Canonical source:** [eric847b/singularity-operator/MERGE_POLICY.md](https://github.com/eric847b/singularity-operator/blob/main/MERGE_POLICY.md)

## Rule (fleet-wide)

Every PR must be able to land on `main` without breaking the live path.

Incomplete work is allowed. Incomplete *execution* is not.

### Multi-file partial landings

If change A and B are both required and only A merges:

1. A must not require B at runtime, **or**
2. A is gated (feature flag / optional import / stub with safe default).

At runtime, if the system hits a dead end (missing piece), it must:

- Remember the intended input
- Take the safe path (do not crash trunk)
- Mark paused for live update
- Resume when the missing software/hardware/signal appears

Implemented in `singularity_operator.incomplete_path` (`IncompletePath`, `IncompletePathRegistry`).

### PR checklist add-on

- [ ] Incomplete code is inert
- [ ] Multi-part work registers recovery if partial merge is possible
- [ ] No force-merge / force-push
- [ ] Main remains shippable

### VS Code

Workspace `.vscode/settings.json` documents this policy and prefers squash merges via the GitHub Pull Requests extension.
