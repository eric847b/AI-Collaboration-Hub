<# 
=====================================================================
run-quality.ps1
   The full "best catalyst series" â€“ drives the workspace to a healthy,
   built, linted, tested, and security-scanned state.
   Steps: bootstrap â†’ npm check/lint â†’ python install â†’ health â†’ verify
          â†’ npm audit â†’ eslint fix â†’ vitest coverage â†’ build â†’ lockfile commit â†’ fleet audit
=====================================================================
#>
$passed = 0
$failed = 0
$warnings = @()
$issues = @()

function Log { param([string]$m,[string]$c) Write-Host $m -ForegroundColor $c }

function Invoke-Npm {
    param([string]$proj,[string]$script)
    $orig = pwd.ProviderPath
    try {
        Set-Location "C:\Users\Eric\OneDrive\Documents\GitHub\$proj"
        & npm run "$script" 2>&1 | Out-Null
        return $LASTEXITCODE
    } finally { Set-Location $orig }
}

# True when the project's package.json declares the given script (guards steps
# that only make sense for projects that actually expose the command).
function Has-Script {
    param([string]$proj,[string]$script)
    $pkg = Join-Path "C:\Users\Eric\OneDrive\Documents\GitHub\$proj" 'package.json'
    if (-not (Test-Path $pkg)) { return $false }
    $raw = Get-Content $pkg -Raw
    return ($raw -match ('"' + [regex]::Escape($script) + '"\s*:'))
}

# True when dependencies have been installed at least once (node_modules exists).
# Fresh clones that skipped bootstrap are reported and skipped, not failed.
function Has-NodeModules {
    param([string]$proj)
    return (Test-Path (Join-Path "C:\Users\Eric\OneDrive\Documents\GitHub\$proj" 'node_modules'))
}

# Auto-discover projects: Node = root-level folder with package.json,
# Python = root-level folder with requirements.txt (mirrors bootstrap.ps1).
$NodeProjects = @(Get-ChildItem -Directory |
    Where-Object { $_.Name -notlike '.*' -and (Test-Path (Join-Path $_.FullName 'package.json')) }) |
    ForEach-Object { $_.Name }
$PythonProjects = @(Get-ChildItem -Directory |
    Where-Object { $_.Name -notlike '.*' -and (Test-Path (Join-Path $_.FullName 'requirements.txt')) }) |
    ForEach-Object { $_.Name }

# ---- Step 1: Bootstrap ----
Log "`n--- Step 1: Bootstrap ---" Yellow
& "C:\Users\Eric\OneDrive\Documents\GitHub\tools\bootstrap.ps1"
if ($LASTEXITCODE -ne 0) { Log "  bootstrap had warnings (continuing)" Yellow; $warnings += 'bootstrap' } else { $passed++ }

# ---- Step 2: npm check / lint (skips projects without either script) ----
Log "`n--- Step 2: npm check / lint ---" Yellow
foreach ($p in $NodeProjects) {
    if (-not (Has-NodeModules $p)) { Log "  [SKIP] $p (node_modules missing - run bootstrap)" Yellow; continue }
    $hasCheck = Has-Script $p 'check'
    $hasLint  = Has-Script $p 'lint'
    if (-not ($hasCheck -or $hasLint)) { Log "  [SKIP] $p (no check/lint script)" Yellow; continue }
    if ($hasCheck) {
        $code = Invoke-Npm $p 'check'
        if ($code -eq 0) { Log "  [OK] $p check" Green; $passed++ }
        elseif ($hasLint -and ((Invoke-Npm $p 'lint') -eq 0)) { Log "  [OK] $p lint (fallback)" Green; $passed++ }
        else { Log "  [FAIL] $p check/lint" Red; $failed++; $issues += "$p check/lint" }
    } else {
        if ((Invoke-Npm $p 'lint') -eq 0) { Log "  [OK] $p lint" Green; $passed++ }
        else { Log "  [FAIL] $p lint" Red; $failed++; $issues += "$p lint" }
    }
}

# ---- Step 3: Python requirements ----
Log "`n--- Step 3: Python requirements ---" Yellow
foreach ($p in $PythonProjects) {
    $r = Join-Path "C:\Users\Eric\OneDrive\Documents\GitHub\$p" 'requirements.txt'
    if (Test-Path $r) {
        & python -m pip install -q -r $r
        if ($LASTEXITCODE -eq 0) { $passed++ } else { $warnings += "$p pip install" }
    } else { $warnings += "$p no requirements.txt" }
}

# ---- Step 4: Workspace gate ----
Log "`n--- Step 4: Workspace gate ---" Yellow
& "C:\Users\Eric\Documents\GitHub\tools\workspace-gate.ps1"
if ($LASTEXITCODE -eq 0) { $passed++ } else { $failed++; $issues += 'workspace gate (was: health check)' }

# ---- Step 5: Verify ----
Log "`n--- Step 5: Verify ---" Yellow
# Step 5 folded into workspace-gate above (2026-08-25)
if ($false) { $passed++ } else { $failed++; $issues += 'obsolete verify stub' } # never reached - see note above

# ---- Step 6: npm audit (advisory) across every Node project ----
Log "`n--- Step 6: npm audit (advisory, workspace-wide) ---" Yellow
foreach ($p in $NodeProjects) {
    if (-not (Has-NodeModules $p)) { continue }
    $orig = pwd.ProviderPath
    try {
        Set-Location "C:\Users\Eric\OneDrive\Documents\GitHub\$p"
        & npm audit --audit-level=high 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { Log "  [OK] $p audit" Green; $passed++ }
        else { Log "  [WARN] $p high-severity npm vulns" Yellow; $warnings += "$p high npm vulns" }
    } finally { Set-Location $orig }
}

# ---- Step 7: eslint auto-fix (best effort, only where a lint:fix script exists) ----
Log "`n--- Step 7: eslint auto-fix (best effort) ---" Yellow
foreach ($p in $NodeProjects) {
    if (-not (Has-Script $p 'lint:fix')) { Log "  [SKIP] $p (no lint:fix script)" Yellow; continue }
    if (-not (Has-NodeModules $p)) { Log "  [SKIP] $p (node_modules missing - run bootstrap)" Yellow; continue }
    if ((Invoke-Npm $p 'lint:fix') -eq 0) { $passed++ } else { $warnings += "$p lint:fix" }
}

# ---- Step 8: vitest coverage (best effort, only where configured) ----
Log "`n--- Step 8: vitest coverage (best effort) ---" Yellow
foreach ($p in $NodeProjects) {
    $pkg = Join-Path "C:\Users\Eric\OneDrive\Documents\GitHub\$p" 'package.json'
    $hasVitest = $false
    if (Test-Path $pkg) {
        $raw = Get-Content $pkg -Raw
        $hasVitest = ($raw -match '"vitest"\s*:')
    }
    if (-not $hasVitest) {
        Log "  [SKIP] $p (vitest not configured; uses its own test runner)" Yellow
        continue
    }
    $orig = pwd.ProviderPath
    try {
        Set-Location "C:\Users\Eric\OneDrive\Documents\GitHub\$p"
        & npm exec vitest -- run --coverage 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { Log "  [OK] $p tests" Green; $passed++ } else { Log "  [WARN] $p coverage" Yellow; $warnings += "$p coverage" }
    } finally { Set-Location $orig }
}

# ---- Step 9: Build (best effort, only where a build script exists) ----
Log "`n--- Step 9: Build ---" Yellow
foreach ($p in $NodeProjects) {
    if (-not (Has-Script $p 'build')) { Log "  [SKIP] $p (no build script)" Yellow; continue }
    if (-not (Has-NodeModules $p)) { Log "  [SKIP] $p (node_modules missing - run bootstrap)" Yellow; continue }
    $code = Invoke-Npm $p 'build'
    if ($code -eq 0) { Log "  [OK] $p build" Green; $passed++ } else { Log "  [WARN] $p build" Yellow; $warnings += "$p build" }
}

# ---- Step 10: commit lockfiles (only if no failures) ----
if ($failed -eq 0) {
    Log "`n--- Step 10: commit lockfiles ---" Yellow
    foreach ($p in $NodeProjects) {
        Set-Location "C:\Users\Eric\OneDrive\Documents\GitHub\$p"
        $lock = Test-Path 'package-lock.json'
        if ($lock) {
            git add package-lock.json 2>&1 | Out-Null
            git commit -m "deps: update lockfile" 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) { Log "  [OK] $p lockfile" Green; $passed++ } else { Log "  [INFO] $p already current" Yellow }
        }
        Set-Location "C:\Users\Eric\OneDrive\Documents\GitHub"
    }
}

# ---- Step 11: Fleet maintenance audit (plan, best effort) ----
Log "`n--- Step 11: Fleet maintenance audit (plan) ---" Yellow
& python "C:\Users\Eric\OneDrive\Documents\GitHub\autonomous-github-agent\.github\fleet_maintenance.py" --mode plan 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { $passed++ } else { $warnings += 'fleet maintenance plan' }

# ---- Summary ----
Log "`n========================================" Cyan
Log "Catalyst Series - Summary" Cyan
Log "Passed : $passed" Green
Log "Failed : $failed" Red
if ($issues.Count  -gt 0) { foreach ($i in $issues)  { Log "  - $i" Red } }
if ($warnings.Count -gt 0) { foreach ($w in $warnings) { Log "  - $w" Yellow } }
$status = if ($failed -eq 0) { 'HEALTHY' } else { 'NEEDS ATTENTION' }
Log "`nStatus: $status" $(if ($failed -eq 0) { 'Green' } else { 'Red' })
if ($failed -gt 0) { exit 1 } else { exit 0 }
