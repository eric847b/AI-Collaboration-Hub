# Where `requirements.txt` and lockfiles are required

This monorepo mixes Node and Python projects. CI and the autonomous agent expect dependency manifests in specific places.

## Python — `requirements.txt`

| Project | Path | Required by |
|---------|------|-------------|
| **autonomous-github-agent** | `autonomous-github-agent/requirements.txt` | `python-checks.yml`, `all-projects-sanity.yml`, agent runtime |
| **singularity-operator** | `singularity-operator/requirements.txt` | same + `requirements-dev.txt` includes `-r requirements.txt` |

### Rules

1. Every matrix entry in `.github/workflows/python-checks.yml` **must** have either:
   - `requirements.txt` at the project root, or
   - `pyproject.toml` (CI falls back to `pip install .`)
2. Do **not** run bare `pip install -r requirements.txt` without an existence check.
3. Optional tooling goes in `requirements-dev.txt` (pytest, flake8, black, mypy).
4. Keep `requirements.txt` aligned with `pyproject.toml` `[project].dependencies` when both exist.

### Adding a new Python project to CI

1. Create `<project>/requirements.txt` (or `pyproject.toml`).
2. Add the project name to the matrix in:
   - `.github/workflows/python-checks.yml` → `matrix.project`
   - `.github/workflows/all-projects-sanity.yml` → `python-projects.matrix.repo`
3. Commit the file so lockfile-validation / health-check stop warning.

## Node — lockfiles

| Project | Expected lockfile | Notes |
|---------|-------------------|-------|
| `nexus-infinity-hub` | `package-lock.json` | npm |
| `self-evolve-dash` | `package-lock.json` (also has `bun.lock`) | CI caches npm lock |
| `third-door-blink-controller` | lockfile if present | Expo app |
| `ai-chat-websites/*` | per-subproject | agent may open lockfile PRs |

### Rules

1. Checkout the **monorepo at the workspace root** (do not use `actions/checkout` `path: <project>` for matrix jobs).
2. Set `working-directory: <project>` and `cache-dependency-path: <project>/package-lock.json`.
3. Prefer exact paths over globs like `*lock*.json` to avoid “paths were not resolved”.

## Agent behavior

The autonomous agent (`agent.py` v4.3+) scans for missing Node lockfiles and missing Python `requirements.txt` / `pyproject.toml` under known project dirs and opens draft PRs to fill gaps.
