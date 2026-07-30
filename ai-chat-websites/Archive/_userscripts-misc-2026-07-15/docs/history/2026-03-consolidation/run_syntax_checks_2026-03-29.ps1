# run_syntax_checks_2026-03-29.ps1
# Runs `node --check` against all .user.js files under this workspace and writes results.

$root = "c:\Users\Eric\OneDrive\Documents\Userscripts\AI Chat Websites\Userscripts"
Set-Location $root
$out = Join-Path $root "syntax_check_2026-03-29.txt"
if (Test-Path $out) { Remove-Item $out -Force }

$files = Get-ChildItem -Path $root -Recurse -Filter '*.user.js' -File -ErrorAction SilentlyContinue
Add-Content -Path $out -Value "Syntax check started: $(Get-Date -Format o)"
foreach ($f in $files) {
  Add-Content -Path $out -Value "=== $($f.FullName) ==="
  try {
    $res = & node --check $f.FullName 2>&1
    if ($res) { $res | ForEach-Object { Add-Content -Path $out -Value $_ } }
    if ($LASTEXITCODE -eq 0) { Add-Content -Path $out -Value "OK" } else { Add-Content -Path $out -Value "ERROR (exit $LASTEXITCODE)" }
  } catch {
    Add-Content -Path $out -Value "EXCEPTION: $($_.Exception.Message)"
  }
  Add-Content -Path $out -Value ""
}
Add-Content -Path $out -Value "Done: $(Get-Date -Format o)"
Write-Output "Wrote $out"