function Show-Tree {
    param (
        [string]$Path = '.',
        [string[]]$ExcludeDirs = @(),
        [string]$IncludeExtension = '.js',
        [int]$Level = 0
    )

    $Indent = ' ' * $Level * 4
    $Branch = '|-- '
    $LastBranch = '`-- '
    $Items = Get-ChildItem -Path $Path

    $ItemCount = $Items.Count
    $Count = 0

    foreach ($Item in $Items) {
        $Count++
        $relativePath = $Item.FullName.Substring((Get-Location).Path.Length + 1)
        $shouldExclude = $False

        # Check if the item is in an excluded directory
        foreach ($exclDir in $ExcludeDirs) {
            if ($relativePath -like "*$exclDir*") {
                $shouldExclude = $True
                break
            }
        }

        # Check for file extension if it's a file and exclude __init__.py files
        if (-not $Item.PSIsContainer) {
            if ($Item.Extension -ne $IncludeExtension -or $Item.Name -eq '__init__.py') {
                $shouldExclude = $True
            }
        }

        # Process if not excluded
        if (-not $shouldExclude) {
            $LineBranch = if ($Count -eq $ItemCount) { $LastBranch } else { $Branch }
            if ($Item.PSIsContainer) {
                Write-Host "${Indent}${LineBranch}$Item/"
                Show-Tree -Path $Item.FullName -ExcludeDirs $ExcludeDirs -IncludeExtension $IncludeExtension -Level ($Level + 1)
            } else {
                Write-Host "${Indent}${LineBranch}$Item"
            }
        }
    }
}

# Example usage, excluding 'lib', '.cache', 'include', 'Scripts' directories, and including only .py files, excluding __init__.py
#Show-Tree -Path '.' -ExcludeDirs 'lib', '.cache', 'include', 'Scripts' -IncludeExtension '.py'
Show-Tree -Path '.' -ExcludeDirs 'lib', '.cache', 'include', -IncludeExtension '.js'
