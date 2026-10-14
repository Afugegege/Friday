/**
 * Friday Floating Pill Controller
 * Pure, subtitle-free waveform visualizer with echo immunity & companion mode
 */

document.addEventListener('DOMContentLoaded', async () => {
  const pillEl = document.getElementById('friday-pill');
  const dragHandle = document.getElementById('drag-handle');
  const closeBtn = document.getElementById('close-btn');

  // Initialize Waveform Visualizer
  const visualizer = new window.WaveformVisualizer('waveform-canvas');
  visualizer.start();

  // Initialize Audio Capture (Microphone)
  const audioCapture = new window.AudioCapture();
  await audioCapture.initMic();

  // Load Config
  let appConfig = await window.fridayAPI.getConfig();
  let activeAudio = null;
  let isExecuting = false;

  function stopSpeaking() {
    if (activeAudio) {
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    wakeWordDetector.setSpeakingState(false);
  }

  // Initialize Wake Word Detector
  const wakeWordDetector = new window.WakeWordDetector({
    audioCapture,
    enabled: appConfig.wakeWordEnabled,
    isMuted: appConfig.isMuted,
    onWake: (data) => {
      stopSpeaking();
      activatePill(data.commandRemainder);
    },
    onSpeech: (data) => {
      handleUserSpeech(data.text, data.isFinal);
    }
  });

  // Start separated audio monitoring (visualizer vs mic VAD)
  audioCapture.startMonitoring(
    (visualizerEnergy) => {
      visualizer.updateAudioEnergy(visualizerEnergy);
    },
    (micEnergy) => {
      wakeWordDetector.checkVoiceActivity(micEnergy);
    }
  );

  if (appConfig.wakeWordEnabled && !appConfig.isMuted) {
    wakeWordDetector.start();
  }

  // --- UI State Management ---
  function setState(state) {
    pillEl.className = `pill-container ${state}`;
    visualizer.setState(state);

    if (state === 'idle') {
      wakeWordDetector.setActiveSession(false);
      stopSpeaking();
    }
  }

  function dismissPill() {
    isCompanionMode = false;
    resetCompanionTimer();
    stopSpeaking();
    window.fridayAPI.cancelTask().catch(() => {});
    setState('idle');
    window.fridayAPI.hidePill();
  }

  let companionTimeout = null;

  function resetCompanionTimer() {
    if (companionTimeout) {
      clearTimeout(companionTimeout);
      companionTimeout = null;
    }
  }

  async function activatePill(initialCommand = '') {
    resetCompanionTimer();
    stopSpeaking();
    window.fridayAPI.showPill();
    setState('listening');
    wakeWordDetector.setActiveSession(true);

    if (initialCommand && initialCommand.trim().length > 1) {
      executeCommand(initialCommand.trim());
    }
  }

  function handleUserSpeech(text, isFinal) {
    if (!text || !text.trim() || isExecuting) return;

    if (isFinal) {
      executeCommand(text);
    }
  }

  async function executeCommand(commandText) {
    if (!commandText || !commandText.trim() || isExecuting) return;
    
    resetCompanionTimer();
    isExecuting = true;
    wakeWordDetector.setActiveSession(false);
    stopSpeaking();

    setState('processing');

    try {
      const response = await window.fridayAPI.processCommand(commandText);
      await presentResponse(response);
    } catch (err) {
      setState('error');
      setTimeout(() => {
        setState('listening');
        wakeWordDetector.setActiveSession(true);
        isExecuting = false;
      }, 2500);
    }
  }

  let isCompanionMode = false;

  async function presentResponse(response) {
    setState('speaking');
    wakeWordDetector.setSpeakingState(true);

    const spokenText = response.spokenText || response.displayText || 'Done.';

    const onSpeechFinished = () => {
      wakeWordDetector.setSpeakingState(false);
      isExecuting = false;

      if (response.shouldDismiss) {
        resetCompanionTimer();
        isCompanionMode = false;
        setTimeout(() => {
          dismissPill();
        }, 800);
      } else if (response.keepOpen || isCompanionMode) {
        // User explicitly asked Friday to stay
        isCompanionMode = true;
        setState('listening');
        wakeWordDetector.setActiveSession(true);

        resetCompanionTimer();
        companionTimeout = setTimeout(() => {
          setState('idle');
          wakeWordDetector.setActiveSession(false);
        }, 10000);
      } else {
        // Default behavior: user did NOT ask Friday to stay, so auto-hide smoothly
        resetCompanionTimer();
        setTimeout(() => {
          dismissPill();
        }, 1800);
      }
    };

    // If fast-path instant action, speak immediately
    if (response.instant) {
      fallbackSpeak(spokenText, onSpeechFinished);
      return;
    }

    // Try OpenAI TTS
    const audioDataUrl = await window.fridayAPI.synthesizeSpeech(spokenText);

    if (audioDataUrl) {
      activeAudio = new Audio(audioDataUrl);
      audioCapture.connectAudioElement(activeAudio);

      activeAudio.onended = () => {
        onSpeechFinished();
      };
      activeAudio.onerror = () => {
        fallbackSpeak(spokenText, onSpeechFinished);
      };

      try {
        await activeAudio.play();
      } catch (e) {
        fallbackSpeak(spokenText, onSpeechFinished);
      }
    } else {
      fallbackSpeak(spokenText, onSpeechFinished);
    }
  }

  function fallbackSpeak(text, onEndCallback = () => {}) {
    if (!window.speechSynthesis) {
      onEndCallback();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const speechSimInterval = setInterval(() => {
      visualizer.updateAudioEnergy(0.3 + Math.random() * 0.45);
    }, 80);

    utterance.onend = () => {
      clearInterval(speechSimInterval);
      visualizer.updateAudioEnergy(0.05);
      onEndCallback();
    };

    utterance.onerror = () => {
      clearInterval(speechSimInterval);
      visualizer.updateAudioEnergy(0.05);
      onEndCallback();
    };

    window.speechSynthesis.speak(utterance);
  }

  // --- Drag & Repositioning ---
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.screenX;
    lastY = e.screenY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.screenX - lastX;
    const deltaY = e.screenY - lastY;
    lastX = e.screenX;
    lastY = e.screenY;

    window.fridayAPI.dragWindow(deltaX, deltaY);
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      window.fridayAPI.savePosition();
    }
  });

  // Clicking the waveform canvas interrupts speaking and triggers listening
  document.getElementById('waveform-canvas').addEventListener('click', () => {
    stopSpeaking();
    activatePill();
  });

  // --- Dismiss & Keybindings ---
  closeBtn.addEventListener('click', () => {
    stopSpeaking();
    dismissPill();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      stopSpeaking();
      dismissPill();
    }
  });

  // --- IPC Events ---
  window.fridayAPI.onActivate(() => {
    stopSpeaking();
    activatePill();
  });

  window.fridayAPI.onMuteToggled((isMuted) => {
    wakeWordDetector.setMuted(isMuted);
    if (isMuted) {
      stopSpeaking();
      setState('error');
    } else {
      setState('listening');
    }
  });

  window.fridayAPI.onStatusUpdate(() => {
    setState('processing');
  });
});
