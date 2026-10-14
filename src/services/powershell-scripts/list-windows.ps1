try {
    $processes = Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.Trim().Length -gt 0 } | 
        Select-Object ProcessName, MainWindowTitle, Id
    if ($processes) {
        $processes | ConvertTo-Json -Compress
    } else {
        Write-Output "[]"
    }
} catch {
    Write-Output "[]"
}
