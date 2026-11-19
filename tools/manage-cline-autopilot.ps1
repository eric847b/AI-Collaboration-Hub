# manage-cline-autopilot.ps1 - start/stop/status for the autonomous driver
param(
    [ValidateSet('start','stop','status','install','uninstall','install-all')]
    [string]$Action = 'status',
    [switch]$SelfTest
)
$TaskName = 'ClineAutopilot'
$ScriptPath = Join-Path $PSScriptRoot 'cline-autopilot.ps1'
if ($SelfTest) {
    $pass = $true
    if (-not (Test-Path $ScriptPath)) { Write-Host 'FAIL: driver missing'; $pass = $false } else { Write-Host 'OK: driver present' }
    if (-not (Test-Path (Join-Path $PSScriptRoot 'cline-autopilot-watchdog.ps1'))) { Write-Host 'FAIL: watchdog missing'; $pass = $false } else { Write-Host 'OK: watchdog present' }
    $cfgPath = Join-Path $PSScriptRoot '..\.renitor\autopilot.json'
    if (-not (Test-Path $cfgPath)) { Write-Host 'FAIL: config missing'; $pass = $false } else { Write-Host 'OK: config present' }
    if ($pass) { Write-Host 'SELF-TEST: PASS'; exit 0 } else { Write-Host 'SELF-TEST: FAIL'; exit 1 }
}
switch ($Action) {
    'install' {
        $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
        $trigger = New-ScheduledTaskTrigger -AtLogOn
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 365)
        $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
        Write-Host "installed scheduled task $TaskName"
    }
    'uninstall' {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
        Write-Host "uninstalled $TaskName"
    }
    'start' {
        Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($LASTEXITCODE -ne 0) { Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`"" }
        Write-Host "started"
    }
    'stop' {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Get-Process -Name powershell -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*cline-autopilot.ps1*' } | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "stopped"
    }
    'install-all' {
        & $PSCommandPath install
        $wdAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSScriptRoot\cline-autopilot-watchdog.ps1`""
        $wdTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
        $wdSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
        $wdPrincipal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
        Register-ScheduledTask -TaskName 'ClineAutopilotWatchdog' -Action $wdAction -Trigger $wdTrigger -Settings $wdSettings -Principal $wdPrincipal -Force | Out-Null
        Write-Host "installed driver + watchdog tasks"
    }
    'status' {
        $t = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($t) { Write-Host "task: $($t.State)"; $t | Get-ScheduledTaskInfo | Format-List LastRunTime,LastTaskResult,NextRunTime }
        else { Write-Host "task not installed" }
        $wd = Get-ScheduledTask -TaskName 'ClineAutopilotWatchdog' -ErrorAction SilentlyContinue
        if ($wd) { Write-Host "watchdog: $($wd.State)" } else { Write-Host 'watchdog: not installed' }
        $hb = Join-Path (Split-Path $PSScriptRoot -Parent) '.renitor\autopilot.heartbeat'
        if (Test-Path $hb) { $a=(Get-Date)-(Get-Item $hb).LastWriteTime; Write-Host ('heartbeat: {0} min ago' -f [math]::Round($a.TotalMinutes,1)) } else { Write-Host 'heartbeat: missing' }
        $procs = @(Get-Process -Name powershell -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*cline-autopilot.ps1*' })
        Write-Host ('driver processes: {0}' -f $procs.Count)
        $st = Join-Path (Split-Path $PSScriptRoot -Parent) '.renitor\autopilot-state.json'
        if (Test-Path $st) { Get-Content $st }
    }
}
