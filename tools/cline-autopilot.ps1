# cline-autopilot.ps1 - Autonomous, continuous driver for the Cline CLI.
param(
    [switch]$Once,
    [int]$MaxLoops = 0,
    [switch]$SelfTest,
    [switch]$JsonOutput,
    [switch]$Version,
    [switch]$DryRun,
    [string]$ConfigPath = (Join-Path $PSScriptRoot '..\.renitor\autopilot.json')
)
$ErrorActionPreference = 'Continue'
function Load-Config($p) { if (-not (Test-Path $p)) { throw "config not found: $p" }; return (Get-Content $p -Raw | ConvertFrom-Json) }
function Write-Log($cfg, $msg) { $line = "[{0}] {1}" -f (Get-Date).ToString('o'), $msg; try { [System.IO.File]::AppendAllText($cfg.logFile, $line + "`n") } catch {}; Write-Host $line }
function Load-Queue($cfg) {
    if (-not (Test-Path $cfg.queueFile)) { return @() }
    $result = New-Object System.Collections.Generic.List[string]
    foreach ($l in (Get-Content $cfg.queueFile -ErrorAction SilentlyContinue)) {
        $t = $l.Trim()
        if ($t -eq '' -or $t.StartsWith('#')) { continue }
        $result.Add($t)
    }
    return ,$result.ToArray()
}
function Load-State($cfg) {
    if (Test-Path $cfg.stateFile) { try { return (Get-Content $cfg.stateFile -Raw | ConvertFrom-Json) } catch {} }
    return [pscustomobject]@{ loop=0; index=0; consecutiveFailures=0; lastRun=$null; status='idle' }
}
function Rotate-Log($cfg) {
    try {
        if (Test-Path $cfg.logFile) {
            $fi = Get-Item $cfg.logFile
            if ($fi.Length -gt 5MB) {
                $bak = $cfg.logFile + '.1'
                if (Test-Path $bak) { Remove-Item $bak -Force -ErrorAction SilentlyContinue }
                Rename-Item $cfg.logFile $bak -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {}
}
function Save-State($cfg, $st) { try { $st | ConvertTo-Json -Compress | Set-Content -Path $cfg.stateFile -Encoding UTF8 } catch {} }

function Run-Cline($cfg, $prompt) {
    $args = @($prompt)
    if ($DryRun) { Write-Log $cfg ('DRY-RUN: ' + $prompt); return $true }
    if ($cfg.autoApprove) { $args += @('--auto-approve','true') }
    $args += @('--timeout', [string]$cfg.timeoutSeconds)
    $args += @('--retries', [string]$cfg.maxRetries)
    $args += @('--compaction', $cfg.compaction)
    if ($cfg.thinking) { $args += @('--thinking', $cfg.thinking) }
    if ($cfg.provider) { $args += @('--provider', $cfg.provider) }
    if ($cfg.model) { $args += @('--model', $cfg.model) }
    if ($cfg.worktree) { $args += '--worktree' }
    $args += @('-c', $cfg.workingDir)
    $args += @('--hooks-dir', $cfg.hooksDir)
    $outFile = Join-Path $env:TEMP 'cline-ap-out.txt'
    $errFile = Join-Path $env:TEMP 'cline-ap-err.txt'
    $inFile  = Join-Path $env:TEMP 'cline-ap-in.txt'
    '' | Out-File -FilePath $inFile -NoNewline -Encoding ascii
    $attempt = 0
    while ($attempt -lt $cfg.maxRetries) {
        $attempt++
        Write-Log $cfg ("attempt $attempt/$($cfg.maxRetries): $($prompt.Substring(0,[Math]::Min(80,$prompt.Length)))")
        if (Test-Path $outFile) { Remove-Item $outFile -Force -ErrorAction SilentlyContinue }
        if (Test-Path $errFile) { Remove-Item $errFile -Force -ErrorAction SilentlyContinue }
        $clineCmd = Join-Path $env:APPDATA 'npm\cline.cmd'
$proc = Start-Process -FilePath $clineCmd -ArgumentList $args -RedirectStandardInput $inFile -RedirectStandardOutput $outFile -RedirectStandardError $errFile -PassThru -WindowStyle Hidden
        $deadline = (Get-Date).AddSeconds($cfg.timeoutSeconds + 60)
        while (-not $proc.HasExited) {
            if ((Get-Date) -gt $deadline) { try { $proc.Kill() } catch {}; Write-Log $cfg "timeout kill"; break }
            Start-Sleep -Seconds 5
        }
        $code = $proc.ExitCode
        $tail = ''
        if (Test-Path $outFile) { $tail = (Get-Content $outFile -Tail 5 -ErrorAction SilentlyContinue) -join ' | ' }
        Write-Log $cfg "exit=$code tail=$tail"
        if ($code -eq 0 -or $code -eq $null) { return $true }
        $sleep = [int]($cfg.backoffSeconds * [Math]::Pow(2, $attempt-1))
        if ($sleep -gt 300) { $sleep = 300 }
        Write-Log $cfg "backing off ${sleep}s"
        Start-Sleep -Seconds $sleep
    }
    return $false
}
$cfg = Load-Config $ConfigPath
Rotate-Log $cfg
if ($Version) { Write-Host "cline-autopilot 1.1.0"; exit 0 }
if ($SelfTest) {
    $pass = $true
    if (-not (Test-Path $cfg.queueFile)) { Write-Host "FAIL: queueFile missing"; $pass = $false } else { Write-Host "OK: queueFile exists" }
    $q = Load-Queue $cfg
    if ($q.Count -lt 1) { Write-Host "FAIL: queue empty"; $pass = $false } else { Write-Host ("OK: queue has " + $q.Count + " prompts") }
    if (-not (Test-Path (Split-Path $cfg.stateFile -Parent))) { Write-Host "FAIL: state dir missing"; $pass = $false } else { Write-Host "OK: state dir exists" }
    $clineCmd = Join-Path $env:APPDATA 'npm\cline.cmd'
if (-not (Test-Path $clineCmd)) { Write-Host "FAIL: cline.cmd missing"; $pass = $false } else { Write-Host "OK: cline.cmd present" }
    if ($pass) { Write-Host "SELF-TEST: PASS"; exit 0 } else { Write-Host "SELF-TEST: FAIL"; exit 1 }
}
Write-Log $cfg "autopilot starting (config=$ConfigPath)"
$loopCount = 0
while ($true) {
    if ($MaxLoops -gt 0 -and $loopCount -ge $MaxLoops) { break }
    $loopCount++
    $st = Load-State $cfg
    $st.loop = $loopCount
    $st.status = 'running'
    try { [System.IO.File]::WriteAllText((Join-Path (Split-Path $cfg.stateFile -Parent) 'autopilot.heartbeat'), (Get-Date).ToString('o')) } catch {}
    Save-State $cfg $st
    $queue = Load-Queue $cfg
    if ($queue.Count -eq 0) {
        if ($cfg.regenerateQueueOnEmpty) { $queue = @($cfg.defaultPrompt); Write-Log $cfg "queue empty -> default prompt" }
        elseif ($Once) { Write-Log $cfg "queue empty; -Once exit"; break }
        else { Write-Log $cfg "queue empty; sleeping"; Start-Sleep -Seconds $cfg.cooldownSeconds; continue }
    }
    $idx = [int]$st.index
    if ($idx -ge $queue.Count) { $idx = 0 }
    $i = $idx
    while ($i -lt $queue.Count) {
        $prompt = $queue[$i]
        $ok = Run-Cline $cfg $prompt
        if ($ok) { $st.consecutiveFailures = 0 } else { $st.consecutiveFailures = [int]$st.consecutiveFailures + 1; Write-Log $cfg "consecutiveFailures=$($st.consecutiveFailures)" }
        $st.index = $i + 1
        $st.lastRun = (Get-Date).ToString('o')
        Save-State $cfg $st
        if ($st.consecutiveFailures -ge $cfg.maxConsecutiveFailures) {
            Write-Log $cfg "too many failures; cooling 5min"
            Start-Sleep -Seconds 300
            $st.consecutiveFailures = 0
            Save-State $cfg $st
        }
        if (-not $DryRun) {
            try {
                $govScript = Join-Path $env:USERPROFILE 'Documents\Cline\Hooks\model-governor.ps1'
$govOut = if (Test-Path $govScript) { & powershell -NoProfile -ExecutionPolicy Bypass -File $govScript auto 2>$null } else { $null }
                if ($govOut) { Write-Log $cfg ("governor: " + (($govOut | Select-Object -Last 1).ToString())) }
            } catch {}
        }
        Start-Sleep -Milliseconds 200
        $i++
    }
    $st.index = 0
    $st.status = 'cooldown'
    Save-State $cfg $st
    Write-Log $cfg "loop $loopCount done; cooldown $($cfg.cooldownSeconds)s"
    if ($Once) { break }
    Start-Sleep -Seconds $cfg.cooldownSeconds
}
Write-Log $cfg "autopilot exiting"
if ($JsonOutput) {
    $st = Load-State $cfg
    $summary = [pscustomobject]@{ loop=$st.loop; status=$st.status; consecutiveFailures=$st.consecutiveFailures; lastRun=$st.lastRun; exitCode=0 }
    $summary | ConvertTo-Json -Compress
}
