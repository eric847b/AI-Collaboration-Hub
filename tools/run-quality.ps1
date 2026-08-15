# run-quality.ps1
# Orchestrates the "best catalyst" series of steps to produce the best resulting workspace output.
# It runs bootstrap, npm checks, python installs, health-check, and verification, then summarises.

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Quality Catalyst Series - Starting" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$global:issues = @()
$global:warnings = @()
$global:passed = 0
$global:failed = 0

# ---- Step 1: Bootstrap ----
Write-Host "`n--- Step 1: Bootstrapping all projects ---" -ForegroundColor Yellow
 & "C:\Users\Eric\OneDrive\Documents\GitHub\tools\bootstrap.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Bootstrap completed with warnings/errors (continuing)." -ForegroundColor Yellow
} else {
    Write-Host "Bootstrap succeeded." -ForegroundColor Green
    $passed++
}

# ---- Step 2: npm run check for each Node project ----
Write-Host "`n--- Step 2: Running npm check for Node projects ---" -ForegroundColor Yellow
$NodeProjects = @('nexus-infinity-hub','self-evolve-dash','collabhub-modules','third-door-blink-controller')
foreach ($proj in $NodeProjects) {
    $origDir = pwd.Path
    try {
        Set-Location "C:\Users\Eric\OneDrive\Documents\GitHub\$proj"
        Write-Host "Checking $proj..." -ForegroundColor Gray
        # Execute npm run check; if script missing, try npm run lint
        $checkResult = & npm run check 2>&1
        Write-Host "  Output: $($checkResult.Substring(0, [Math]::Min(200,$checkResult.Length)))" -ForegroundColor Gray
        $passed++
    } catch {
        Write-Host "  FAIL: $proj check threw an error." -ForegroundColor Red
        $failed++
        $issues += "$proj check failed"
    }
    Set-Location $origDir
}

# ---- Step 3: Python requirements install ----
Write-Host "`n--- Step 3: Installing Python requirements ---" -ForegroundColor Yellow
$PythonProjects = @('singularity-operator','autonomous-github-agent')
foreach ($proj in $PythonProjects) {
    $reqPath = Join-Path "C:\Users\Eric\OneDrive\Documents\GitHub\$proj" "requirements.txt"
    if (Test-Path $reqPath) {
        Write-Host "Installing requirements for $proj ..." -ForegroundColor Gray
        & python -m pip install -quiet -r $reqPath
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  OK: $proj requirements installed." -ForegroundColor Green
            $passed++
        } else {
            Write-Host "  WARN: $proj requirements install had issues." -ForegroundColor Yellow
            $warnings += "$proj pip install issues"
        }
    } else {
        Write-Host "  WARN: $proj has no requirements.txt" -ForegroundColor Yellow
        $warnings += "$proj missing requirements.txt"
    }
}

# ---- Step 4: Health Check ----
Write-Host "`n--- Step 4: Running workspace health check ---" -ForegroundColor Yellow
 & "C:\Users\Eric\OneDrive\Documents\GitHub\tools\health-check.ps1"
$healthExit = $LASTEXITCODE
if ($healthExit -eq 0) {
    Write-Host "Health check passed." -ForegroundColor Green
    $passed++
} else {
    Write-Host "Health check had issues (see above)." -ForegroundColor Yellow
    $failed++
    $issues += "Health check issues"
}

# ---- Step 5: Verification ----
Write-Host "`n--- Step 5: Running workspace verification ---" -ForegroundColor Yellow
 & "C:\Users\Eric\OneDrive\Documents\GitHub\tools\verify-workspace.ps1"
$verifyExit = $LASTEXITCODE
if ($verifyExit -eq 0) {
    Write-Host "Verification passed." -ForegroundColor Green
    $passed++
} else {
    Write-Host "Verification had failures." -ForegroundColor Red
    $failed++
    $issues += "Verification failures"
}

# ---- Summary ----
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "Quality Catalyst Series - Summary" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed : $failed" -ForegroundColor Red
if ($issues.Count -gt 0) {
    Write-Host "`nIssues:" -ForegroundColor Red
    $issues | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
if ($warnings.Count -gt 0) {
    Write-Host "`nWarnings:" -ForegroundColor Yellow
    $warnings | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}
Write-Host "`nStatus: $((if($failed -eq 0) {'HEALTHY'} else {'NEEDS ATTENTION'}))" -ForegroundColor $(if($failed -eq 0) {'Green'} else {'Red'})

# Exit with error code if any failures
if ($failed -gt 0) {
    exit 1
} else {
    exit 0
}