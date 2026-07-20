<#
Simple bootstrap script to install Node and Python dependencies
for each subfolder repository.
#>
param(
  [switch]$Install
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

$root = Get-Location
Write-Host "Bootstrapping repositories under: $root"

Get-ChildItem -Path $root -Directory | ForEach-Object {
    $repo = $_.FullName
    $name = $_.Name
    if (Test-Path (Join-Path $repo 'package.json')) {
        Write-Host "--- Node: $name ---"
        Push-Location $repo
        if (Test-Path 'package-lock.json') {
            npm ci
        } elseif (Test-Path 'pnpm-lock.yaml') {
            pnpm install
        } elseif (Test-Path 'yarn.lock') {
            yarn install
        } else {
            npm install
        }
        Pop-Location
    }

    if (Test-Path (Join-Path $repo 'requirements.txt')) {
        Write-Host "--- Python: $name ---"
        $venv = Join-Path $repo '.venv'
        if (-not (Test-Path $venv)) {
            python -m venv $venv
        }
        $pythonExe = Join-Path $venv 'Scripts\python.exe'
        if (Test-Path $pythonExe) {
            & $pythonExe -m pip install --upgrade pip
            & $pythonExe -m pip install -r (Join-Path $repo 'requirements.txt')
        } else {
            Write-Warning "Python executable not found for $name at $pythonExe"
        }
    }
}

Write-Host "Bootstrap finished."
