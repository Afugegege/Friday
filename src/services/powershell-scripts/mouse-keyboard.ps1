param (
    [string]$Action = "click",
    [int]$X = 0,
    [int]$Y = 0,
    [string]$Text = "",
    [int]$ScrollAmount = 0
)

try {
    $typeDef = @"
    using System;
    using System.Runtime.InteropServices;
    public class ComputerOps {
        [DllImport("user32.dll")]
        public static extern bool SetCursorPos(int X, int Y);
        [DllImport("user32.dll")]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, int dwData, UIntPtr dwExtraInfo);
        
        public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        public const uint MOUSEEVENTF_LEFTUP = 0x0004;
        public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        public const uint MOUSEEVENTF_WHEEL = 0x0800;
    }
"@
    Add-Type -TypeDefinition $typeDef -ErrorAction SilentlyContinue

    if ($Action -eq "click") {
        [ComputerOps]::SetCursorPos($X, $Y)
        Start-Sleep -Milliseconds 40
        [ComputerOps]::mouse_event([ComputerOps]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
        Start-Sleep -Milliseconds 40
        [ComputerOps]::mouse_event([ComputerOps]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
        Write-Output "CLICK_SUCCESS"
    }
    elseif ($Action -eq "double_click") {
        [ComputerOps]::SetCursorPos($X, $Y)
        Start-Sleep -Milliseconds 40
        [ComputerOps]::mouse_event([ComputerOps]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
        Start-Sleep -Milliseconds 30
        [ComputerOps]::mouse_event([ComputerOps]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
        Start-Sleep -Milliseconds 80
        [ComputerOps]::mouse_event([ComputerOps]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
        Start-Sleep -Milliseconds 30
        [ComputerOps]::mouse_event([ComputerOps]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
        Write-Output "DOUBLE_CLICK_SUCCESS"
    }
    elseif ($Action -eq "right_click") {
        [ComputerOps]::SetCursorPos($X, $Y)
        Start-Sleep -Milliseconds 40
        [ComputerOps]::mouse_event([ComputerOps]::MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, [UIntPtr]::Zero)
        Start-Sleep -Milliseconds 40
        [ComputerOps]::mouse_event([ComputerOps]::MOUSEEVENTF_RIGHTUP, 0, 0, 0, [UIntPtr]::Zero)
        Write-Output "RIGHT_CLICK_SUCCESS"
    }
    elseif ($Action -eq "scroll") {
        [ComputerOps]::mouse_event([ComputerOps]::MOUSEEVENTF_WHEEL, 0, 0, $ScrollAmount, [UIntPtr]::Zero)
        Write-Output "SCROLL_SUCCESS"
    }
    elseif ($Action -eq "type") {
        Add-Type -AssemblyName System.Windows.Forms
        # If text ends with enter, handle it cleanly
        $cleanText = $Text.Replace("+", "{+}").Replace("^", "{^}").Replace("%", "{%}").Replace("~", "{~}").Replace("(", "{(}").Replace(")", "{)}")
        [System.Windows.Forms.SendKeys]::SendWait($cleanText)
        Write-Output "TYPE_SUCCESS"
    }
    elseif ($Action -eq "key") {
        Add-Type -AssemblyName System.Windows.Forms
        $keyMap = @{
            "enter"     = "{ENTER}"
            "tab"       = "{TAB}"
            "esc"       = "{ESC}"
            "escape"    = "{ESC}"
            "space"     = " "
            "backspace" = "{BACKSPACE}"
            "up"        = "{UP}"
            "down"      = "{DOWN}"
            "left"      = "{LEFT}"
            "right"     = "{RIGHT}"
        }
        $sendKey = $keyMap[$Text.ToLower()]
        if (-not $sendKey) { $sendKey = $Text }
        [System.Windows.Forms.SendKeys]::SendWait($sendKey)
        Write-Output "KEY_SUCCESS"
    }
} catch {
    Write-Error $_.Exception.Message
}
