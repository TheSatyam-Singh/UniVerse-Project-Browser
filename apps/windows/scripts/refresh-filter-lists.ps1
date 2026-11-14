param(
    [string]$Destination = (Join-Path $PSScriptRoot "filter-lists-cache")
)

$ErrorActionPreference = "Stop"

$Lists = @(
    @("easylist.txt", "https://easylist.to/easylist/easylist.txt"),
    @("easyprivacy.txt", "https://easylist.to/easylist/easyprivacy.txt"),
    @("peter-lowes.txt", "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0&mimetype=plaintext"),
    @("ublock-filters.min.txt", "https://ublockorigin.github.io/uAssetsCDN/filters/filters.min.txt"),
    @("ublock-unbreak.txt", "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/unbreak.txt"),
    @("ublock-badware.txt", "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt"),
    @("ublock-privacy.min.txt", "https://ublockorigin.github.io/uAssetsCDN/filters/privacy.min.txt"),
    @("ublock-quick-fixes.txt", "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/quick-fixes.txt"),
    @("adguard-url-tracking.txt", "https://filters.adtidy.org/extension/ublock/filters/17.txt"),
    @("urlhaus-filter.txt", "https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-online.txt")
)

New-Item -ItemType Directory -Force -Path $Destination | Out-Null

foreach ($entry in $Lists) {
    $name = $entry[0]
    $url = $entry[1]
    $target = Join-Path $Destination $name
    $temp = "$target.tmp"
    try {
        Invoke-WebRequest -Uri $url -OutFile $temp -TimeoutSec 90 -UseBasicParsing
        $first = Get-Content -Path $temp -TotalCount 200 | Where-Object { $_.Trim() -ne "" } | Select-Object -First 1
        $size = (Get-Item $temp).Length
        if ($size -lt 5000 -or -not ($first.TrimStart().StartsWith("[") -or $first.TrimStart().StartsWith("!") -or $first.TrimStart().StartsWith("#"))) {
            Write-Host "refresh-filter-lists: $name looks wrong (size $size, first line: $first); keeping old copy"
            Remove-Item $temp -Force -ErrorAction SilentlyContinue
            continue
        }
        Move-Item $temp $target -Force
        Write-Host "$name $((Get-Item $target).Length) bytes"
    }
    catch {
        Write-Host "refresh-filter-lists: $name failed: $($_.Exception.Message)"
        Remove-Item $temp -Force -ErrorAction SilentlyContinue
    }
}
