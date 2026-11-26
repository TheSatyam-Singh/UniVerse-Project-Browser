param(
    [string]$Configuration = "Release",
    [string]$Platform = "x64",
    [switch]$SkipWebUi,
    [switch]$Package,
    [string]$SignThumbprint = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $root
Set-Location $repo

if (-not $SkipWebUi) {
    $webUi = Join-Path $root "Universe.Windows\Assets\WebUI"
    if (Test-Path $webUi) {
        Remove-Item -Recurse -Force $webUi
    }
    pnpm --filter @universe/demo run build:windows
    if ($LASTEXITCODE -ne 0) {
        throw "Windows web UI build failed"
    }
}

dotnet build (Join-Path $root "Universe.Windows\Universe.Windows.csproj") -c $Configuration
if ($LASTEXITCODE -ne 0) {
    throw "WinUI app build failed"
}

if ($Package) {
    $msbuildArgs = @(
        (Join-Path $root "Universe.Windows.Package\Universe.Windows.Package.wapproj"),
        "/p:Configuration=$Configuration",
        "/p:Platform=$Platform",
        "/p:AppxPackageDir=$root\Universe.Windows.Package\AppPackages\"
    )
    if ($SignThumbprint -eq "") {
        $msbuildArgs += "/p:AppxPackageSigningEnabled=false"
    } else {
        $msbuildArgs += "/p:PackageCertificateThumbprint=$SignThumbprint"
    }
    & msbuild @msbuildArgs
    if ($LASTEXITCODE -ne 0) {
        throw "MSIX package build failed"
    }
}

Write-Host "Windows build done."
