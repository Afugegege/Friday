# PROJECT FRIDAY
## A Personal AI Voice Desktop Assistant for Windows

FRIDAY is a functional, intelligent, voice-first AI desktop assistant for Windows inspired by JARVIS and Siri, built specifically for desktop productivity. It runs quietly in the system tray, responds to local wake-word detection, understands natural language across English and Mandarin Chinese, renders an elegant floating pill with a multi-layered harmonic waveform, and performs real tasks on Windows without stealing keyboard focus from active work (such as PDF readers, VS Code, or terminals).

---

## 🌟 Key Features

1. **The Signature Floating Pill Overlay**
   - Translucent dark glassmorphism container (`360px × 72px`).
   - Programmatically rendered **harmonic waveform** with 42 fine, overlapping sinusoidal curves.
   - Curves dynamically react to **real-time microphone audio input** during listening and **output voice audio** during speech.
   - Smooth state transitions: `IDLE`, `LISTENING`, `PROCESSING`, `SPEAKING`, and `ERROR`.
   - Drag handle to reposition anywhere on the screen with position memory.
   - Non-focus-stealing design (`showInactive()`, `focusable: false`) so typing in foreground applications is never interrupted.

2. **Local Wake-Word Detection & Hotkeys**
   - On-device speech recognition monitors continuously for `"Friday"` or `"Hey Friday"` without streaming continuous audio to cloud servers.
   - Global hotkey `Ctrl + Alt + F` to activate Friday immediately.
   - Global mute toggle `Ctrl + Alt + M` for instant privacy.

3. **Multilingual Voice & Intelligence**
   - Powered by OpenAI GPT-4o with multi-turn conversation memory.
   - Fluently understands English, Mandarin Chinese (普通话), and code-switching ("Chinglish").
   - OpenAI TTS voice synthesis (`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`) with automatic Web Speech fallback.

4. **Modular Tool Registry**
   - **Spotify & Media Controls**: Windows SMTC and media key transport for instantaneous Play/Pause, Next, Previous, and Volume control, plus Spotify Web API support.
   - **Web Search & Research**: Live internet research via DuckDuckGo and Wikipedia with full page content parsing.
   - **Windows Computer Control**: Launch desktop apps (VS Code, Spotify, browsers, terminal, notepad, etc.), inspect active windows.
   - **File Operations**: Search files in Documents, Desktop, Downloads, and Projects; read preview; open with native handlers.
   - **Screen Inspection (Vision)**: Captures screen context for Friday to explain documents, diagrams, or code currently open on screen.
   - **Persistent Notes & Memory**: Save reminders and notes directly into Friday's memory and local files.

---

## 📁 Project Structure

```
Friday/
├── package.json
├── .env.example
├── README.md
├── tests/
│   └── test-modules.js            # Automated verification test suite
├── src/
│   ├── config/
│   │   └── config.js              # Environment & local settings manager
│   ├── main/
│   │   ├── main.js                # Electron app entry, tray, and global shortcuts
│   │   ├── window-manager.js      # Non-focus-stealing pill window & positioning
│   │   └── ipc-handlers.js        # Secure IPC bridge & native screen capturer
│   ├── preload/
│   │   └── preload.js             # Context-isolated secure preload bridge
│   ├── renderer/
│   │   ├── index.html             # Floating pill HTML markup
│   │   ├── settings.html          # Interactive settings window
│   │   ├── css/
│   │   │   └── style.css          # Glassmorphic, minimal styling & animations
│   │   └── js/
│   │       ├── visualizer.js      # 42-curve harmonic waveform canvas engine
│   │       ├── audio-capture.js   # Web Audio API microphone energy analyzer
│   │       ├── wake-word.js       # Local wake-word speech recognition
│   │       └── pill-controller.js # UI state, TTS playback & auto-dismiss manager
│   ├── services/
│   │   ├── ai-orchestrator.js     # OpenAI Chat + Tool Execution + TTS pipeline
│   │   ├── memory-service.js      # Persistent JSON storage for notes & history
│   │   ├── web-search-service.js  # Live search & HTML content extractor
│   │   ├── spotify-service.js     # Spotify API + Windows media keys fallback
│   │   ├── windows-automation.js  # App launcher, file search, media events
│   │   ├── screen-service.js      # Native & PowerShell screen capture
│   │   └── powershell-scripts/    # Robust PowerShell helper scripts
│   └── tools/
│       └── tool-registry.js       # Validated OpenAI function calling schemas
```

---

## 🚀 Setup & Getting Started

### 1. Prerequisites
- **Windows 10 or 11**
- **Node.js**: v18.0.0 or later (Tested on Node v22.18.0)
- **PowerShell**: Built-in Windows PowerShell

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure API Credentials
Create a `.env` file in the project root (or configure via the Settings UI):
```ini
OPENAI_API_KEY=sk-proj-your-openai-api-key-here
FRIDAY_VOICE=alloy
WAKE_WORD_ENABLED=true
AUTO_HIDE_DELAY_MS=4000
```
> Alternatively, right-click the Friday tray icon and select **Settings...** to set the API key in the graphical interface.

### 4. Run Friday
```bash
# Start Friday in the background with system tray and floating pill
npm start

# Or run tests to verify all backend modules
npm test

# Run Electron launch verification
npm run verify
```

---

## ⌨️ Shortcuts & Wake Phrases

| Action | Shortcut / Wake Phrase | Description |
|---|---|---|
| **Voice Activation** | Say `"Friday"` or `"Hey Friday"` | Opens the floating pill and begins listening |
| **Hotkey Activation** | `Ctrl + Alt + F` | Immediately activates the pill without speaking the wake word |
| **Global Mute** | `Ctrl + Alt + M` | Toggles microphone listening on/off |
| **Dismiss Pill** | `Esc` or click `×` | Instantly hides the floating pill |
| **Settings Window** | Right-click Tray icon → **Settings...** | Opens API key, voice, and timing settings |

---

## 🛠️ Automated Tests Performed

Run the backend test suite anytime:
```bash
npm test
```

Results:
- **Tool Registry**: 14 tools registered with complete JSON schema validation (Pass).
- **Persistent Memory**: Saved and retrieved notes and history (Pass).
- **Web Search**: Live retrieval of current articles and definitions (Pass).
- **Windows Automation**: Process inspection and file search (Pass).
- **Media Controls**: Windows Virtual Keycode transport execution (Pass).
- **Electron Lifecycle**: Clean startup, non-focus-stealing window creation, and tray registration (Pass).
