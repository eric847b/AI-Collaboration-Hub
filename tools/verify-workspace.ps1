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

# Check Node projects
Write-Host "`nNode Projects:" -ForegroundColor Yellow
@('nexus-infinity-hub', 'self-evolve-dash', 'collabhub-modules') | ForEach-Object {
    $pkg = Join-Path $_ 'package.json'
    if (Test-Path $pkg) {
        Write-Host "  OK: $_ (package.json present)" -ForegroundColor Green
        $passed++
    }
}

# Check Python projects
Write-Host "`nPython Projects:" -ForegroundColor Yellow
@('singularity-operator', 'autonomous-github-agent') | ForEach-Object {
    $req = Join-Path $_ 'requirements.txt'
    if (Test-Path $req) {
        Write-Host "  OK: $_ (requirements.txt present)" -ForegroundColor Green
        $passed++
    }
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
