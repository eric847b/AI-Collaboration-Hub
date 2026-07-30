<#
  archive_duplicates_2026-03-29.ps1
  Moves files listed in duplicate_clusters_2026-03-29.json into _auto_archive_2026-03-29.

  Usage:
    Open PowerShell, cd to this script's folder, then:
      ./archive_duplicates_2026-03-29.ps1

  This script is safe: it only moves files that exist and are not already in an _archive folder.
#>

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$jsonPath = Join-Path $scriptDir 'duplicate_clusters_2026-03-29.json'
if (-not (Test-Path $jsonPath)) {
  Write-Error "JSON file not found at $jsonPath. Place this script next to the JSON file."
  exit 1
}
try {
  $json = Get-Content -Path $jsonPath -Raw | ConvertFrom-Json
} catch {
  Write-Error "Failed to parse JSON: $_"
  exit 1
}

# Find workspace root (first ancestor named 'Userscripts', otherwise fallback two levels up)
$rootCandidate = $scriptDir
while ($true) {
  $leaf = Split-Path -Leaf $rootCandidate
  if ($leaf -ieq 'Userscripts') { break }
  $parent = Split-Path -Parent $rootCandidate
  if ($parent -eq $rootCandidate) { break }
  $rootCandidate = $parent
}
if ((Split-Path -Leaf $rootCandidate) -ieq 'Userscripts') {
  $workspaceRoot = $rootCandidate
} else {
  $workspaceRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
}

$archiveRoot = Join-Path $workspaceRoot '_auto_archive_2026-03-29'
New-Item -Path $archiveRoot -ItemType Directory -Force | Out-Null

foreach ($cluster in $json.clusters) {
  foreach ($dup in $cluster.duplicates) {
    if (-not $dup) { continue }
    $dupNorm = $dup -replace '/','\' 
    $dupNorm = $dupNorm.TrimStart('\')
    # Build candidate full path - try rooted and relative to workspaceRoot
    if ([System.IO.Path]::IsPathRooted($dupNorm)) {
      $fullPath = $dupNorm
    } else {
      $fullPath = Join-Path $workspaceRoot $dupNorm
    }
    # Skip if already archived
    if ($fullPath -match '\\_archive\\' -or $fullPath -match '\\_auto_archive_2026-03-29\\') {
      Write-Host "Skipping already-archived path: $fullPath"
      continue
    }
    if (-not (Test-Path $fullPath)) {
      # try alternative without redundant 'AI Chat Websites\Userscripts\' prefix
      $alt = $dupNorm -replace 'AI Chat Websites\\Userscripts\\',''
      $altFull = Join-Path $workspaceRoot $alt
      if (Test-Path $altFull) {
        $fullPath = $altFull
      } else {
        Write-Warning "File not found: $fullPath"
        continue
      }
    }
    $rel = $fullPath.Substring($workspaceRoot.Length).TrimStart('\')
    $dest = Join-Path $archiveRoot $rel
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path $destDir)) {
      New-Item -Path $destDir -ItemType Directory -Force | Out-Null
    }
    try {
      Move-Item -Path $fullPath -Destination $dest -Force -Verbose
      Write-Host "Moved: $fullPath -> $dest"
    } catch {
      Write-Warning "Failed to move $fullPath : $_"
    }
  }
}
Write-Host "Archive complete. Review: $archiveRoot"
