const os = require('os');
const { execFile, exec } = require('child_process');
const https = require('https');

class HardwareService {
  /**
   * Complete hardware overview: CPU, RAM, Disk, Uptime, Battery
   */
  async getSystemMetrics() {
    const totalMem = (os.totalmem() / (1024 ** 3)).toFixed(1);
    const freeMem = (os.freemem() / (1024 ** 3)).toFixed(1);
    const usedMem = (totalMem - freeMem).toFixed(1);
    const memUsagePct = Math.round((usedMem / totalMem) * 100);

    const cpus = os.cpus();
    const cpuModel = cpus && cpus[0] ? cpus[0].model.trim() : 'Unknown CPU';
    const cpuCores = cpus.length;

    // Get disk and battery via fast powershell
    const psScript = `
      $d = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction SilentlyContinue
      $freeDisk = if ($d) { [math]::Round($d.FreeSpace / 1GB, 1) } else { 0 }
      $totalDisk = if ($d) { [math]::Round($d.Size / 1GB, 1) } else { 0 }
      
      $b = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue
      $batteryPct = if ($b) { $b.EstimatedChargeRemaining } else { -1 }
      
      @{ FreeDisk = $freeDisk; TotalDisk = $totalDisk; Battery = $batteryPct } | ConvertTo-Json -Compress
    `;

    return new Promise((resolve) => {
      execFile('powershell.exe', ['-NoProfile', '-Command', psScript], (err, stdout) => {
        let diskInfo = { FreeDisk: 'N/A', TotalDisk: 'N/A', Battery: -1 };
        try {
          if (stdout) diskInfo = JSON.parse(stdout);
        } catch (e) {}

        const uptimeHours = Math.floor(os.uptime() / 3600);
        const uptimeMins = Math.floor((os.uptime() % 3600) / 60);

        resolve({
          success: true,
          cpu: `${cpuModel} (${cpuCores} cores)`,
          ram: `${usedMem} GB / ${totalMem} GB (${memUsagePct}% used)`,
          disk: `C: Drive ${diskInfo.FreeDisk} GB free of ${diskInfo.TotalDisk} GB`,
          battery: diskInfo.Battery >= 0 ? `${diskInfo.Battery}%` : 'Desktop (No Battery)',
          uptime: `${uptimeHours}h ${uptimeMins}m`,
          summary: `System status: CPU ${cpuModel} (${cpuCores} cores). RAM: ${usedMem}GB/${totalMem}GB used (${memUsagePct}%). C: Drive: ${diskInfo.FreeDisk}GB free of ${diskInfo.TotalDisk}GB. Uptime: ${uptimeHours}h ${uptimeMins}m.`
        });
      });
    });
  }

  /**
   * Network diagnostics: Local IP, Public IP, and Ping Latency
   */
  async getNetworkDiagnostics() {
    const interfaces = os.networkInterfaces();
    let localIp = '127.0.0.1';

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIp = iface.address;
          break;
        }
      }
    }

    // Fetch public IP via ipify
    const publicIp = await new Promise((resolve) => {
      https.get('https://api.ipify.org?format=json', { timeout: 3000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data).ip);
          } catch (e) {
            resolve('Unknown');
          }
        });
      }).on('error', () => resolve('Offline or protected')).on('timeout', () => resolve('Timeout'));
    });

    // Test ping latency to Cloudflare 1.1.1.1
    const pingLatency = await new Promise((resolve) => {
      exec('ping -n 1 1.1.1.1', (err, stdout) => {
        if (!err && stdout) {
          const match = stdout.match(/Average = (\d+)ms|time[=<](\d+)ms/i);
          if (match) {
            resolve(`${match[1] || match[2]} ms`);
            return;
          }
        }
        resolve('Connected');
      });
    });

    return {
      success: true,
      localIp,
      publicIp,
      latency: pingLatency,
      summary: `Network Diagnostics: Local IP is ${localIp}, Public IP is ${publicIp}. Internet latency is ${pingLatency}.`
    };
  }

  /**
   * Empties Windows Recycle Bin
   */
  async emptyRecycleBin() {
    return new Promise((resolve) => {
      exec('powershell.exe -NoProfile -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"', (err) => {
        if (err) {
          resolve({ success: false, message: 'Could not empty Recycle Bin.' });
        } else {
          resolve({ success: true, message: 'Windows Recycle Bin emptied successfully.' });
        }
      });
    });
  }

  /**
   * Set Master Volume to specific percentage (0 - 100)
   */
  async setVolumeLevel(percent) {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    const ps = `
      $obj = New-Object -ComObject WScript.Shell
      # approximate step
      1..50 | ForEach-Object { $obj.SendKeys([char]174) }
      $steps = [math]::Round(${clamped} / 2)
      1..$steps | ForEach-Object { $obj.SendKeys([char]175) }
    `;
    return new Promise((resolve) => {
      exec(`powershell.exe -NoProfile -Command "${ps.replace(/\r?\n/g, ' ')}"`, () => {
        resolve({ success: true, volume: clamped, message: `Volume set to approximately ${clamped}%.` });
      });
    });
  }
}

module.exports = new HardwareService();
