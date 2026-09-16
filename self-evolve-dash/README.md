# self-evolve-dash

Vite + React dashboard (Tampermonkey / automation UI).

## Package manager (CI)

**npm is canonical.** CI uses `package-lock.json` only.

```bash
cd self-evolve-dash
npm ci          # preferred
npm run build
```

Do not commit `bun.lock` / `bun.lockb` / `yarn.lock` — they are gitignored to avoid dual-lock drift that broke builds.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | local Vite |
| `npm run build` | production build |
| `npm run ci` | lint + typecheck + build |

Husky is skipped when `CI=true` or `HUSKY=0`.
