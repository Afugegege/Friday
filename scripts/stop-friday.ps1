$fridayProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*Projects\Friday*" }
foreach ($p in $fridayProcesses) {
    try {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    } catch {}
}

