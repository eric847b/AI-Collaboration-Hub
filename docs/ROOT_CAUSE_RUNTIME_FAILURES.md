# Runtime failure root causes (2026-09)

## Classes (FailureSolver v3.6+)

| Class | Meaning | Typical fix |
|-------|---------|-------------|
| `rate_limit` | npm/GitHub API 429 during **install** | retries, prefer-offline, backoff |
| `npm_install` | install/resolution failed (not necessarily 429) | lockfile align, legacy-peer-deps |
| `build_error` | **Build** step failed after install | toolchain (Tailwind/Vite), entrypoints |
| `generic_exit` | non-zero exit, unclassified | inspect job logs |
| registry missing | nexus enforce required module not on disk | present-only registry / optional_modules |

## Confirmed incidents

1. **nexus-core enforce** — registry listed peers not vendored → fixed registry v2.9.1.
2. **self-evolve-dash Build** — Tailwind v4 + v3 `@tailwind` CSS; dual bun/npm locks; husky on CI → fixed #596 (tailwind 3.4, npm canonical, husky skip).
3. **Mislabeling** — install OK + build fail was often tagged `rate_limit` → FailureSolver `build_error` heuristic.

## Policy

- Do not treat `rate_limit` as high-severity notify.
- Prefer fixing **build_error** over retrying installs when the Build step is the failing step.
