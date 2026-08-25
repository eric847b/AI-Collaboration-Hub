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

# Node projects (auto-discovered: any root-level folder with package.json)
Write-Host ""
Write-Host "Node Projects Lockfile Status:" -ForegroundColor Yellow
$NodeProjects = @(Get-ChildItem -Directory |
    Where-Object { $_.Name -notlike '.*' -and (Test-Path (Join-Path $_.FullName 'package.json')) }) |
    ForEach-Object { @{name = $_.Name; lockfile = 'package-lock.json'} }
if ($NodeProjects.Count -eq 0) { Write-Host "  [ERROR] no Node projects discovered" -ForegroundColor Red; $Issues += 'no Node projects discovered' }
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

# Python projects (auto-discovered: any root-level folder with requirements.txt)
$PythonProjects = @(Get-ChildItem -Directory |
    Where-Object { $_.Name -notlike '.*' -and (Test-Path (Join-Path $_.FullName 'requirements.txt')) }) |
    ForEach-Object { $_.Name }
if ($PythonProjects.Count -eq 0) { Write-Host "  [ERROR] no Python projects discovered" -ForegroundColor Red; $Issues += 'no Python projects discovered' }
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
