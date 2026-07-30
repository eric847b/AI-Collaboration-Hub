# PowerShell script to minify userscripts while preserving headers

param(
    [string]$FilePath
)

if (-not (Test-Path $FilePath)) {
    Write-Error "File not found: $FilePath"
    exit 1
}

$content = Get-Content $FilePath -Raw

# Find the end of the userscript header
$headerEndPattern = "(?s)==/UserScript==\s*\r?\n"
$headerMatch = [regex]::Match($content, $headerEndPattern)

if (-not $headerMatch.Success) {
    Write-Error "Could not find userscript header end in $FilePath"
    exit 1
}

$header = $content.Substring(0, $headerMatch.Index + $headerMatch.Length)
$code = $content.Substring($headerMatch.Index + $headerMatch.Length)

# Write code to temp file
$tempFile = [System.IO.Path]::GetTempFileName() + ".js"
$code | Out-File -FilePath $tempFile -Encoding UTF8

# Minify with terser
$minifiedFile = [System.IO.Path]::GetTempFileName() + ".js"
& terser $tempFile -o $minifiedFile --compress --mangle

if ($LASTEXITCODE -ne 0) {
    Write-Error "Terser failed for $FilePath"
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    exit 1
}

$minifiedCode = Get-Content $minifiedFile -Raw

# Combine header and minified code
$newContent = $header + $minifiedCode

# Write back to original file
$newContent | Out-File -FilePath $FilePath -Encoding UTF8

# Clean up temp files
Remove-Item $tempFile -ErrorAction SilentlyContinue
Remove-Item $minifiedFile -ErrorAction SilentlyContinue

Write-Host "Minified $FilePath"