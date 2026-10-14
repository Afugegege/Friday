const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fridayAPI', {
  // Pill Window Controls
  hidePill: () => ipcRenderer.send('friday:hide-pill'),
  showPill: () => ipcRenderer.send('friday:show-pill'),
  dragWindow: (deltaX, deltaY) => ipcRenderer.send('friday:drag-window', { deltaX, deltaY }),
  savePosition: () => ipcRenderer.send('friday:save-position'),
  setIgnoreMouse: (ignore) => ipcRenderer.send('friday:set-ignore-mouse', ignore),

  // Assistant & Voice Actions
  processCommand: (text, options) => ipcRenderer.invoke('friday:process-command', text, options),
  transcribeAudio: (arrayBuffer, mimeType) => ipcRenderer.invoke('friday:transcribe-audio', arrayBuffer, mimeType),
  synthesizeSpeech: (text) => ipcRenderer.invoke('friday:synthesize-speech', text),
  notifyStatus: (status) => ipcRenderer.send('friday:notify-status', status),

  // Configuration
  getConfig: () => ipcRenderer.invoke('friday:get-config'),
  saveConfig: (newConfig) => ipcRenderer.invoke('friday:save-config', newConfig),

  // Events from Main Process to Renderer
  onActivate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('friday:activate', handler);
    return () => ipcRenderer.removeListener('friday:activate', handler);
  },
  onMuteToggled: (callback) => {
    const handler = (_event, isMuted) => callback(isMuted);
    ipcRenderer.on('friday:mute-toggled', handler);
    return () => ipcRenderer.removeListener('friday:mute-toggled', handler);
  },
  onStatusUpdate: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('friday:status-update', handler);
    return () => ipcRenderer.removeListener('friday:status-update', handler);
  }
});
