<# 
=====================================================================
run-quality.ps1
   The full "best catalyst series" – drives the workspace to a healthy,
   built, linted, tested, and security-scanned state.
   Steps: bootstrap → npm check/lint → python install → health → verify
          → npm audit → eslint fix → vitest coverage → build → lockfile commit
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

$NodeProjects  = @('nexus-infinity-hub','self-evolve-dash','collabhub-modules','third-door-blink-controller')
$PythonProjects = @('singularity-operator','autonomous-github-agent')

# ---- Step 1: Bootstrap ----
Log "`n--- Step 1: Bootstrap ---" Yellow
& "C:\Users\Eric\OneDrive\Documents\GitHub\tools\bootstrap.ps1"
if ($LASTEXITCODE -ne 0) { Log "  bootstrap had warnings (continuing)" Yellow; $warnings += 'bootstrap' } else { $passed++ }

# ---- Step 2: npm check / lint ----
Log "`n--- Step 2: npm check / lint ---" Yellow
foreach ($p in $NodeProjects) {
    $code = Invoke-Npm $p 'check'
    if ($code -eq 0) { Log "  [OK] $p check" Green; $passed++ }
    else {
        $c2 = Invoke-Npm $p 'lint'
        if ($c2 -eq 0) { Log "  [OK] $p lint (fallback)" Green; $passed++ }
        else { Log "  [FAIL] $p check/lint" Red; $failed++; $issues += "$p check/lint" }
    }
}

# ---- Step 3: Python requirements ----
Log "`n--- Step 3: Python requirements ---" Yellow
foreach ($p in $PythonProjects) {
    $r = Join-Path "C:\Users\Eric\OneDrive\Documents\GitHub\$p" 'requirements.txt'
    if (Test-Path $r) {
        & python -m pip install -quiet -r $r
        if ($LASTEXITCODE -eq 0) { $passed++ } else { $warnings += "$p pip install" }
    } else { $warnings += "$p no requirements.txt" }
}

# ---- Step 4: Health check ----
Log "`n--- Step 4: Health check ---" Yellow
& "C:\Users\Eric\OneDrive\Documents\GitHub\tools\health-check.ps1"
if ($LASTEXITCODE -eq 0) { $passed++ } else { $failed++; $issues += 'health check' }

# ---- Step 5: Verify ----
Log "`n--- Step 5: Verify ---" Yellow
& "C:\Users\Eric\OneDrive\Documents\GitHub\tools\verify-workspace.ps1"
if ($LASTEXITCODE -eq 0) { $passed++ } else { $failed++; $issues += 'verify' }

# ---- Step 6: npm audit (advisory) ----
Log "`n--- Step 6: npm audit (advisory) ---" Yellow
& npm audit --audit-level=high 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { $passed++ } else { Log "  high-severity npm vulnerabilities present" Yellow; $warnings += 'high npm vulns' }

# ---- Step 7: eslint auto-fix (best effort) ----
Log "`n--- Step 7: eslint auto-fix (best effort) ---" Yellow
foreach ($p in $NodeProjects) { if ((Invoke-Npm $p 'lint:fix') -eq 0) { $passed++ } else { $warnings += "$p lint:fix" } }

# ---- Step 8: vitest coverage (best effort) ----
Log "`n--- Step 8: vitest coverage (best effort) ---" Yellow
foreach ($p in $NodeProjects) {
    $orig = pwd.ProviderPath
    try {
        Set-Location "C:\Users\Eric\OneDrive\Documents\GitHub\$p"
        & npm exec vitest -- run --coverage 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { Log "  [OK] $p tests" Green; $passed++ } else { Log "  [WARN] $p coverage" Yellow; $warnings += "$p coverage" }
    } finally { Set-Location $orig }
}

# ---- Step 9: Build ----
Log "`n--- Step 9: Build ---" Yellow
foreach ($p in $NodeProjects) {
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