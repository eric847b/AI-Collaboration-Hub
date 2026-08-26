<#
=====================================================================
 workspace-gate.ps1  (v3)
 Obsoletes: verify-workspace.ps1 + health-check.ps1 (both removed).

 Superset of everything those scripts checked, PLUS:
   - workflow count of zero is now a FAILURE (was silently passed)
   - actionlint runs against every workflow when available
   - Node engines range vs installed runtime comparison
   - pre-commit hook presence + LF purity check
 Exit codes preserved: 0 = pass (warnings allowed), 1 = failure.
=====================================================================
#>
$ErrorActionPreference = 'Stop'
$passed = 0
$failed = 0
$warnings = @()

function Log { param([string]$m, [string]$c) Write-Host $m -ForegroundColor $c }
function Ok { param([string]$m) Log "  OK: $m" Green; $script:passed++ }
function Fail { param([string]$m) Log "  FAIL: $m" Red; $script:failed++ }
function Warn { param([string]$m) Log "  WARN: $m" Yellow; $script:warnings += $m }

Log "Workspace Gate v3" Cyan
Log "=================" Cyan

# ---- Shared configs -------------------------------------------------
Log "`nShared Configs:" Yellow
@('.editorconfig', '.gitattributes', '.eslintrc.json', '.prettierrc',
  'package.json', '.pre-commit-config.yaml',
  'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md') | ForEach-Object {
    if (Test-Path $_) { Ok $_ } else { Fail "$_ missing" }
}

# ---- CI workflows: count AND lint -----------------------------------
Log "`nCI Workflows:" Yellow
$wf = @(Get-ChildItem '.github/workflows' -Filter '*.yml' -ErrorAction SilentlyContinue)
if ($wf.Count -eq 0) { Fail 'no workflows found' } else { Ok "$($wf.Count) workflows present" }

$actionlint = 'C:\Users\Eric\Documents\Cline\Tools\actionlint.exe'
if (-not (Test-Path $actionlint)) { $actionlint = (Get-Command actionlint.exe -ErrorAction SilentlyContinue).Source }
if ($actionlint -and (Test-Path $actionlint)) {
    $out = & $actionlint 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) { Ok 'actionlint clean' }
    else { Fail "actionlint findings:`n$out" }
} else { Warn 'actionlint unavailable - workflow lint skipped' }

# ---- Node projects (auto-discovered) --------------------------------
Log "`nNode Projects:" Yellow
$nodeProjects = @(Get-ChildItem -Directory |
    Where-Object { $_.Name -notlike '.*' -and (Test-Path (Join-Path $_.FullName 'package.json')) })
if ($nodeProjects.Count -eq 0) { Fail 'no Node projects discovered' }
foreach ($p in $nodeProjects) {
    if (Test-Path (Join-Path $p.FullName 'package-lock.json')) { Ok "$($p.Name) (lockfile present)" }
    else { Warn "$($p.Name) missing package-lock.json" }
}

# ---- Python projects (auto-discovered) ------------------------------
Log "`nPython Projects:" Yellow
$pyProjects = @(Get-ChildItem -Directory |
    Where-Object { $_.Name -notlike '.*' -and (Test-Path (Join-Path $_.FullName 'requirements.txt')) })
if ($pyProjects.Count -eq 0) { Fail 'no Python projects discovered' }
$pyProjects | ForEach-Object { Ok "$($_.Name) (requirements.txt present)" }

# ---- Node engines vs runtime ----------------------------------------
Log "`nNode Engines Check:" Yellow
$pkgRaw = Get-Content 'package.json' -Raw
if ($pkgRaw -match '"node"\s*:\s*">=\s*(\d+)') {
    $requiredMajor = [int]$Matches[1]
    $v = (& node -v) -replace '^v', ''
    $runtimeMajor = [int]($v.Split('.')[0])
    if ($runtimeMajor -ge $requiredMajor) { Ok "node v$v satisfies >= $requiredMajor" }
    else { Warn "node v$v < engines requirement >= $requiredMajor (npm not engine-strict; informational)" }
} else { Warn 'no engines.node range declared in root package.json' }

# ---- Pre-commit hook integrity ---------------------------------------
Log "`nPre-commit Hook:" Yellow
if (Test-Path '.husky/pre-commit') {
    $bytes = [System.IO.File]::ReadAllBytes('.husky/pre-commit')
    if ($bytes -contains 13) { Fail '.husky/pre-commit contains CR bytes - sh will break (pin: gitattributes eol=lf)' }
    else { Ok 'present and LF-pure' }
} else { Warn '.husky/pre-commit absent - clones get no pre-commit gate' }

# ---- Summary ----------------------------------------------------------
Log "`n=================" Cyan
Log ("Passed=$passed Failed=$failed Warnings=$($warnings.Count)") Cyan
foreach ($w in $warnings) { Log "  warn: $w" Yellow }

if ($failed -gt 0) { Log 'Status: FAIL' Red; exit 1 }
Log 'Status: PASS' Green
exit 0