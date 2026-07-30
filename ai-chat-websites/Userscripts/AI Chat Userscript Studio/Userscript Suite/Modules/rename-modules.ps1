# Rename Modules Script
# This script will rename all module files with unique sequential numbers
# and update the @name metadata inside each file

$files = Get-ChildItem -Path . -Filter "*.module.user.js" | Where-Object { $_.Name -match '^(\d+)-' } | Sort-Object Name

$counter = 0
$fileMapping = @{}

# First pass - collect all files and assign new numbers
foreach($file in $files) {
    $originalName = $file.Name
    $baseName = $originalName -replace '^\d+-', ''
    $newNumber = $counter.ToString("00")
    $newName = "$newNumber.$baseName"
    
    $fileMapping[$originalName] = @{
        NewName = $newName
        Number = $counter
    }
    
    $counter++
}

# Second pass - rename files and update metadata
foreach($originalName in $fileMapping.Keys) {
    $mapping = $fileMapping[$originalName]
    $newName = $mapping.NewName
    $number = $mapping.Number
    
    Write-Host "Processing: $originalName -> $newName"
    
    # Read file content
    $content = Get-Content -Path $originalName -Raw
    
    # Update @name metadata
    if ($content -match '// ==UserScript==') {
        $content = $content -replace '(?m)// @name\s+.*', "// @name         $number. $newName"
    }
    
    # Write updated content
    Set-Content -Path $originalName -Value $content -NoNewline
    
    # Rename file
    Rename-Item -Path $originalName -NewName $newName -Force
}

Write-Host "`nComplete! Renamed $($fileMapping.Count) files with unique sequential numbers."
Write-Host "All files now follow the format: ##.name.module.user.js"
Write-Host "@name metadata updated in all files to match the new filename."