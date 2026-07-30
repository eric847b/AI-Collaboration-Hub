# Archive duplicates (2026-03-29)

This creates an archive of the duplicate userscripts identified in `duplicate_clusters_2026-03-29.json`.

What it does
- Moves files listed in `duplicate_clusters_2026-03-29.json` into `_auto_archive_2026-03-29`, preserving directory structure.
- Skips files already inside `_archive` or `_auto_archive_2026-03-29`.
- Does not delete any files beyond moving them into the archive folder.

Preview duplicates (PowerShell)

Run this to list which of the listed duplicates currently exist on disk:

```powershell
$root = (Get-Location).Path
$json = Get-Content .\duplicate_clusters_2026-03-29.json -Raw | ConvertFrom-Json
foreach ($c in $json.clusters) {
  foreach ($d in $c.duplicates) {
    $p = Join-Path $root ($d -replace '/','\\')
    if (Test-Path $p) { Write-Output $p }
  }
}
```

Run the archiver

1. Open PowerShell and change to the script folder (example):

```powershell
cd "AI Chat Websites\Userscripts"
```

2. Run the script:

```powershell
.\archive_duplicates_2026-03-29.ps1
```

Undo (manual)
- To restore a file, move it back from `_auto_archive_2026-03-29\...` to its original path.

Notes
- Review the archive folder after running to confirm expected moves.
- If you prefer a dry-run first, use the Preview command above to inspect existing duplicates before running the archiver.
