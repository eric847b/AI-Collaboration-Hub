# Simple workspace verification script
$passed = 0
$failed = 0

Write-Host "Workspace Verification" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan

# Check shared configs
Write-Host "`nShared Configs:" -ForegroundColor Yellow
@('.editorconfig', '.gitattributes', '.eslintrc.json', '.prettierrc', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md') | ForEach-Object {
    if (Test-Path $_) {
        Write-Host "  OK: $_" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  FAIL: $_ missing" -ForegroundColor Red
        $failed++
    }
}

# Check workflows
Write-Host "`nCI Workflows:" -ForegroundColor Yellow
$wf = @(Get-ChildItem '.github/workflows' -Filter '*.yml' -ErrorAction SilentlyContinue).Count
Write-Host "  Found $wf workflows" -ForegroundColor Green
$passed++

# Check Node projects (auto-discovered: any root-level folder with package.json)
Write-Host "`nNode Projects:" -ForegroundColor Yellow
$nodeProjects = @(Get-ChildItem -Directory |
    Where-Object { $_.Name -notlike '.*' -and (Test-Path (Join-Path $_.FullName 'package.json')) })
if ($nodeProjects.Count -eq 0) {
    Write-Host "  FAIL: no Node projects discovered" -ForegroundColor Red
    $failed++
}
$nodeProjects | ForEach-Object {
    Write-Host "  OK: $($_.Name) (package.json present)" -ForegroundColor Green
    $passed++
}

# Check Python projects (auto-discovered: any root-level folder with requirements.txt)
Write-Host "`nPython Projects:" -ForegroundColor Yellow
$pythonProjects = @(Get-ChildItem -Directory |
    Where-Object { $_.Name -notlike '.*' -and (Test-Path (Join-Path $_.FullName 'requirements.txt')) })
if ($pythonProjects.Count -eq 0) {
    Write-Host "  FAIL: no Python projects discovered" -ForegroundColor Red
    $failed++
}
$pythonProjects | ForEach-Object {
    Write-Host "  OK: $($_.Name) (requirements.txt present)" -ForegroundColor Green
    $passed++
}

Write-Host "`n======================" -ForegroundColor Cyan
Write-Host "Summary: Passed=$passed, Failed=$failed" -ForegroundColor Cyan

if ($failed -eq 0) {
    Write-Host "Status: PASS" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Status: FAIL" -ForegroundColor Red
    exit 1
}
