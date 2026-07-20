<#
Comprehensive health check for workspace:
- Validates lockfiles exist for all Node projects
- Checks Python requirements are specified
- Warns about missing CI workflows
#>

$Issues = @()
$Warnings = @()

Write-Host "" 
Write-Host "Workspace Health Check" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan

# Expected Node projects with lockfiles
$NodeProjects = @(
    @{name = 'nexus-infinity-hub'; lockfile = 'package-lock.json'},
    @{name = 'self-evolve-dash'; lockfile = 'package-lock.json'},
    @{name = 'collabhub-modules'; lockfile = 'package-lock.json'},
    @{name = 'third-door-blink-controller'; lockfile = 'package-lock.json'}
)

Write-Host ""
Write-Host "Node Projects Lockfile Status:" -ForegroundColor Yellow
$NodeProjects | ForEach-Object {
    $proj = $_.name
    $lock = Join-Path $proj $_.lockfile
    if (Test-Path (Join-Path $proj 'package.json')) {
        if (Test-Path $lock) {
            Write-Host "  [OK] $proj" -ForegroundColor Green
        } else {
            Write-Host "  [WARN] $proj - missing $($_.lockfile)" -ForegroundColor Yellow
            $Warnings += "$proj missing $($_.lockfile)"
        }
    }
}

# Python projects
$PythonProjects = @('singularity-operator', 'autonomous-github-agent')
Write-Host ""
Write-Host "Python Projects:" -ForegroundColor Yellow
$PythonProjects | ForEach-Object {
    $proj = $_
    $req = Join-Path $proj 'requirements.txt'
    if (Test-Path $req) {
        Write-Host "  [OK] $proj" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] $proj - no requirements.txt" -ForegroundColor Yellow
        $Warnings += "$proj missing requirements.txt"
    }
}

# CI Workflows
Write-Host ""
Write-Host "CI Workflow Coverage:" -ForegroundColor Yellow
$wfCount = (Get-ChildItem '.github/workflows' -Filter '*.yml' -ErrorAction SilentlyContinue).Count
if ($wfCount -gt 0) {
    Write-Host "  [OK] Found $wfCount workflows" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] No workflows found" -ForegroundColor Red
    $Issues += "Missing .github/workflows"
}

# Summary
Write-Host ""
Write-Host "======================" -ForegroundColor Cyan
$issueColor = if ($Issues.Count -gt 0) { 'Red' } else { 'Green' }
$warningColor = if ($Warnings.Count -gt 0) { 'Yellow' } else { 'Green' }
Write-Host "Issues: $($Issues.Count)" -ForegroundColor $issueColor
Write-Host "Warnings: $($Warnings.Count)" -ForegroundColor $warningColor

if ($Issues.Count -gt 0) {
    Write-Host ""
    Write-Host "Critical Issues:" -ForegroundColor Red
    $Issues | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

if ($Warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "Warnings (fix when possible):" -ForegroundColor Yellow
    $Warnings | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    Write-Host "Recommendation: Run 'npm run bootstrap' then commit lockfiles" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Status: HEALTHY" -ForegroundColor Green
exit 0
