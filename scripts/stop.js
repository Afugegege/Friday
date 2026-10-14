const { exec } = require('child_process');

// Find and kill any running Friday electron instances
const psScript = `
$procs = Get-Process electron -ErrorAction SilentlyContinue
foreach ($p in $procs) {
    try {
        if ($p.Path -and $p.Path.ToLower().Contains("friday")) {
            Stop-Process -Id $p.Id -Force
            Write-Output "Stopped PID: $($p.Id)"
        }
    } catch {}
}
`;

exec(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`, (err, stdout) => {
  if (stdout && stdout.trim()) {
    console.log(stdout.trim());
  } else {
    console.log("No previous Friday instances were running.");
  }
});
