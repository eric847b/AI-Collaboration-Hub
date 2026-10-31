# manage-cline-autopilot.ps1 - start/stop/status for the autonomous driver
param(
    [ValidateSet('start','stop','status','install','uninstall','install-all')]
    [string]$Action = 'status'
)
$TaskName = 'ClineAutopilot'
$ScriptPath = Join-Path $PSScriptRoot 'cline-autopilot.ps1'
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
        # install the driver task
        & $PSCommandPath install
        # install the watchdog task (every 5 min)
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
        $st = Join-Path (Split-Path $PSScriptRoot -Parent) '.renitor\autopilot-state.json'
        if (Test-Path $st) { Get-Content $st }
    }
}
