param (
    [string]$Action = "play"
)

$keyCodes = @{
    "play_pause"  = 0xB3
    "play"        = 0xB3
    "pause"       = 0xB3
    "next"        = 0xB0
    "previous"    = 0xB1
    "prev"        = 0xB1
    "stop"        = 0xB2
    "volume_up"   = 0xAF
    "volume_down" = 0xAE
    "mute"        = 0xAD
}

$vk = 0xB3
if ($keyCodes.ContainsKey($Action.ToLower())) {
    $vk = $keyCodes[$Action.ToLower()]
}

try {
    $typeDef = @"
    using System;
    using System.Runtime.InteropServices;
    public class WinMediaKey {
        [DllImport("user32.dll")]
        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    }
"@
    Add-Type -TypeDefinition $typeDef -ErrorAction SilentlyContinue
    [WinMediaKey]::keybd_event([byte]$vk, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 25
    [WinMediaKey]::keybd_event([byte]$vk, 0, 2, [UIntPtr]::Zero)
    Write-Output "SUCCESS"
} catch {
    Write-Error $_.Exception.Message
}
