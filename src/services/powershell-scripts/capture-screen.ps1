param (
    [string]$OutputPath = "$env:TEMP\friday_screen_capture.png"
)

try {
    $dpiDef = @"
    using System;
    using System.Runtime.InteropServices;
    public class DpiAwareness {
        [DllImport("user32.dll")]
        public static extern bool SetProcessDPIAware();
    }
"@
    Add-Type -TypeDefinition $dpiDef -ErrorAction SilentlyContinue
    [DpiAwareness]::SetProcessDPIAware() | Out-Null
} catch {}

[Reflection.Assembly]::LoadWithPartialName("System.Drawing") | Out-Null
[Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms") | Out-Null

try {
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen(0, 0, 0, 0, $bitmap.Size)
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
    Write-Output "SUCCESS"
} catch {
    Write-Error $_.Exception.Message
}
