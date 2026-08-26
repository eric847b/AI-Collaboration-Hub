<# 
=====================================================================
analyze-freedom.ps1
   Scans repos and outputs a simple freedom report.
=====================================================================
#>
# Workspace root
$WorkspaceRoot = Split-Path -Parent $PSScriptRoot
# Repos to examine (top‑level folders we know)
$Repos = @(
    'nexus-infinity-hub',
    'self-evolve-dash',
    'collabhub-modules',
    'third-door-blink-controller',
    'singularity-operator',
    'autonomous-github-agent',
    'AI-Collaboration-Hub',
    'VectorFS',
    'third-door-system',
    'tools'
)
# Collect basic info
$inventory = @()
foreach ($repo in $Repos) {
    $path = Join-Path $WorkspaceRoot $repo
    if (-not (Test-Path $path)) { continue }
    $hasPj = Test-Path (Join-Path $path 'package.json')
    $py = Get-ChildItem -Path $path -Filter '*.py' -File | Select-Object -ExpandProperty Name
    $nodeScripts = ''
    if ($hasPj) {
        $json = (Get-Content (Join-Path $path 'package.json') -Raw | ConvertFrom-Json)
        if ($json.scripts) {
            $nodeScripts = @($json.scripts.PSObject.Properties.Name) -join ', '
        }
    }
    $inventory += [pscustomobject]@{
        Name        = $repo
        HasPackageJson = $hasPj
        NodeScripts = $nodeScripts
        PythonScripts = @($py)
    }
}
# Build the report lines
$lines = @()
$lines += '# Freedom Automation Plan'
$lines += ''
$lines += "> Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
$lines += ''
$lines += '## Repo Summary'
$lines += ''
foreach ($r in $inventory) {
    $fin = 0; $bio = 0; $chr = 0
    if ($r.NodeScripts -match 'check|lint|test|build') { $fin++ }
    if ($r.NodeScripts -match 'deploy|publish|ci') { $fin++ }
    if (($r.PythonScripts -join ' ') -match 'health|med|fit|sensor|monitor') { $bio++ }
    if ($r.NodeScripts -match 'auto|script|task|cron') { $chr++ }
    $line = "- **$($r.Name)** : pkg.json=$($r.HasPackageJson), scripts=[$($r.NodeScripts)], Financial=$fin, Bio=$bio, Chores=$chr"
    $lines += $line
}
$lines += ''
$lines += '## Suggested next steps'
$lines += '- Financial: add a nightly check that pulls budget data from Plaid and writes to a local SQLite DB.'
$lines += '- Biological: wrap any health/sensor Python scripts in a cron job that posts to a Home Assistant dashboard.'
$lines += '- Chores: create a task script that reads a TODO markdown file and triggers Home Assistant or IFTTT actions.'
$lines += ''
$output = $lines -join "`n"
$outPath = Join-Path $WorkspaceRoot 'FreedomReport.txt'
Set-Content -Path $outPath -Value $output -Encoding UTF8
Write-Host "Freedom report written to $outPath"