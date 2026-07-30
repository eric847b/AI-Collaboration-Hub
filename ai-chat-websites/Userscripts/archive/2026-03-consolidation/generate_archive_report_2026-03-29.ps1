# generate_archive_report_2026-03-29.ps1
# Scans duplicate_clusters_2026-03-29.json and reports status for each listed duplicate.

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = $scriptDir
$jsonPath = Join-Path $root 'duplicate_clusters_2026-03-29.json'
$archiveRoot = Join-Path $root '_auto_archive_2026-03-29'

if (-not (Test-Path $jsonPath)) {
  Write-Error "Missing JSON: $jsonPath"
  exit 1
}

$json = Get-Content -Path $jsonPath -Raw | ConvertFrom-Json

$report = [PSCustomObject]@{
  generated_at = (Get-Date).ToString('o')
  archiveRoot = $archiveRoot
  archiveContents = @()
  clusters = @()
}

if (Test-Path $archiveRoot) {
  $report.archiveContents = Get-ChildItem -Path $archiveRoot -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
}

foreach ($cluster in $json.clusters) {
  $cObj = [PSCustomObject]@{
    id = $cluster.id
    canonical = $cluster.canonical
    duplicates = @()
  }
  foreach ($dup in $cluster.duplicates) {
    if (-not $dup) { continue }
    $dupNorm = $dup -replace '/','\\'
    $requested = $dup
    $foundPaths = @()

    # Candidate: exact relative to workspace
    $candidate = Join-Path $root $dupNorm
    if (Test-Path $candidate) { $foundPaths += (Get-Item $candidate).FullName }

    # Candidate: strip leading 'AI Chat Websites\Userscripts\' if present
    $alt = $dupNorm -replace '^AI Chat Websites\\Userscripts\\',''
    $altPath = Join-Path $root $alt
    if ((Test-Path $altPath) -and ($altPath -ne $candidate)) { $foundPaths += (Get-Item $altPath).FullName }

    # Candidate: search by basename across workspace
    $base = Split-Path $dupNorm -Leaf
    if ($base) {
      $matches = Get-ChildItem -Path $root -Recurse -File -Filter $base -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
      foreach ($m in $matches) { if (-not ($foundPaths -contains $m)) { $foundPaths += $m } }
    }

    $archiveRootNormalized = [System.IO.Path]::GetFullPath($archiveRoot).TrimEnd('\')
    $movedPaths = $foundPaths | Where-Object { $_.StartsWith($archiveRootNormalized, [System.StringComparison]::OrdinalIgnoreCase) }
    if ($movedPaths.Count -gt 0 -and $foundPaths.Count -gt $movedPaths.Count) { $status = 'mixed' }
    elseif ($movedPaths.Count -gt 0) { $status = 'moved' }
    elseif ($foundPaths.Count -gt 0) { $status = 'present' }
    else { $status = 'missing' }

    $dupObj = [PSCustomObject]@{
      requested = $requested
      foundPaths = $foundPaths
      status = $status
    }
    $cObj.duplicates += $dupObj
  }
  $report.clusters += $cObj
}

$outPath = Join-Path $root 'archive_report_2026-03-29.json'
Write-Output "DEBUG_OUT_PATH: $outPath"
$report | ConvertTo-Json -Depth 10 | Set-Content -Path $outPath -Encoding UTF8
Write-Output "Report written to: $outPath"
