# cline-autopilot-watchdog.ps1 - second-level watchdog: restarts the driver if its heartbeat goes stale.
param(
    [int]$StaleMinutes = 10,
    [switch]$SelfTest,
    [string]$ConfigPath = (Join-Path $PSScriptRoot '..\.renitor\autopilot.json')
)
$ErrorActionPreference = 'Continue'
if ($SelfTest) {
    $pass = $true
    if (-not (Test-Path $ConfigPath)) { Write-Host 'FAIL: config missing'; $pass = $false } else { Write-Host 'OK: config present' }
    if (-not (Test-Path (Join-Path $PSScriptRoot 'cline-autopilot.ps1'))) { Write-Host 'FAIL: driver missing'; $pass = $false } else { Write-Host 'OK: driver present' }
    if ($pass) { Write-Host 'SELF-TEST: PASS'; exit 0 } else { Write-Host 'SELF-TEST: FAIL'; exit 1 }
}
if (-not (Test-Path $ConfigPath)) { Write-Host "config not found: $ConfigPath"; exit 2 }
$cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$hb  = Join-Path (Split-Path $cfg.stateFile -Parent) 'autopilot.heartbeat'
$driver = Join-Path $PSScriptRoot 'cline-autopilot.ps1'
$stale = $true
$ageMin = $null
if (Test-Path $hb) {
    $age = (Get-Date) - (Get-Item $hb).LastWriteTime
    $ageMin = [math]::Round($age.TotalMinutes, 1)
    if ($age.TotalMinutes -lt $StaleMinutes) { $stale = $false }
}
$running = @(Get-Process -Name powershell -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*cline-autopilot.ps1*' })
if ($stale -or $running.Count -eq 0) {
    $running | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$driver`"" -WindowStyle Hidden
    Write-Host ("restarted driver (stale={0}, heartbeatAgeMin={1}, running={2})" -f $stale, $ageMin, $running.Count)
} else {
    Write-Host ("driver healthy (heartbeat age {0}m < {1}m, processes={2})" -f $ageMin, $StaleMinutes, $running.Count)
}
