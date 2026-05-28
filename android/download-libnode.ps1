param(
    [string]$Version = "18.20.4",
    [string]$OutputDir = ".\app\libnode\bin"
)

$releases = @{
    "arm64-v8a" = "https://github.com/nicandris/nodejs-mobile/releases/download/v$Version/nodejs-mobile-v$Version-android-arm64.tar.xz"
    "x86_64"    = "https://github.com/nicandris/nodejs-mobile/releases/download/v$Version/nodejs-mobile-v$Version-android-x86_64.tar.xz"
}

foreach ($abi in $releases.Keys) {
    $url = $releases[$abi]
    $outDir = Join-Path $OutputDir $abi
    $tarFile = Join-Path $outDir "nodejs-mobile.tar.xz"

    if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

    $libFile = Join-Path $outDir "libnode.so"
    if (Test-Path $libFile) {
        Write-Host "[$abi] libnode.so already exists, skipping"
        continue
    }

    Write-Host "[$abi] Downloading nodejs-mobile v$Version..."
    Invoke-WebRequest -Uri $url -OutFile $tarFile -UseBasicParsing

    Write-Host "[$abi] Extracting libnode.so..."
    & tar xf $tarFile -C $outDir --include="*/lib/libnode.so" --strip-components=2 2>$null
    if (-not (Test-Path $libFile)) {
        & tar xf $tarFile -C $outDir 2>$null
        $found = Get-ChildItem $outDir -Recurse -Filter "libnode.so" | Select-Object -First 1
        if ($found) { Move-Item $found.FullName $libFile -Force }
    }

    Remove-Item $tarFile -Force -ErrorAction SilentlyContinue
    Get-ChildItem $outDir -Directory | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

    if (Test-Path $libFile) {
        $size = [math]::Round((Get-Item $libFile).Length / 1MB, 1)
        Write-Host "[$abi] Done ($size MB)"
    } else {
        Write-Host "[$abi] ERROR: libnode.so not found after extraction"
    }
}