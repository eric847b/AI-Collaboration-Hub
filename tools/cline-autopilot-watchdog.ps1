# cline-autopilot-watchdog.ps1 - second-level watchdog: restarts the driver if its heartbeat goes stale.
param(
    [int]$StaleMinutes = 10,
    [string]$ConfigPath = (Join-Path $PSScriptRoot '..\.renitor\autopilot.json')
)
$ErrorActionPreference = 'Continue'
$cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$hb  = Join-Path (Split-Path $cfg.stateFile -Parent) 'autopilot.heartbeat'
$driver = Join-Path $PSScriptRoot 'cline-autopilot.ps1'
$stale = $true
if (Test-Path $hb) {
    $age = (Get-Date) - (Get-Item $hb).LastWriteTime
    if ($age.TotalMinutes -lt $StaleMinutes) { $stale = $false }
}
$running = Get-Process -Name powershell -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*cline-autopilot.ps1*' }
if ($stale -or -not $running) {
    Get-Process -Name powershell -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*cline-autopilot.ps1*' } | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$driver`"" -WindowStyle Hidden
    Write-Host ("restarted driver (stale={0}, running={1})" -f $stale, [bool]$running)
} else {
    Write-Host ("driver healthy (heartbeat age < {0}m, processes={1})" -f $StaleMinutes, $running.Count)
}
