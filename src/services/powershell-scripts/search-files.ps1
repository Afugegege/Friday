param (
    [string]$Query = "",
    [int]$MaxResults = 10
)

try {
    $roots = @(
        "$env:USERPROFILE\Documents",
        "$env:USERPROFILE\Desktop",
        "$env:USERPROFILE\Downloads",
        "$env:USERPROFILE\Documents\Projects"
    )
    $results = @()
    foreach ($r in $roots) {
        if (Test-Path $r) {
            $found = Get-ChildItem -Path $r -Filter "*$Query*" -Recurse -Depth 3 -ErrorAction SilentlyContinue | 
                Select-Object -First $MaxResults FullName, Name, Length, LastWriteTime
            if ($found) {
                $results += $found
            }
        }
    }
    if ($results) {
        $results | Select-Object -First $MaxResults | ConvertTo-Json -Compress
    } else {
        Write-Output "[]"
    }
} catch {
    Write-Output "[]"
}
