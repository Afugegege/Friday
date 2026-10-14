/**
 * Local Audio VAD & Keyword Detector for Friday
 * Includes concurrency locking and speaker feedback immunity.
 */

class WakeWordDetector {
  constructor(options = {}) {
    this.enabled = options.enabled !== undefined ? options.enabled : true;
    this.isMuted = options.isMuted || false;
    this.audioCapture = options.audioCapture;
    this.onWake = options.onWake || (() => {});
    this.onSpeech = options.onSpeech || (() => {});

    this.activeSession = false; // true when pill is open and capturing command
    this.isFridaySpeaking = false; // true when Friday is currently outputting speech
    this.isProcessingRecording = false; // concurrency lock to avoid queueing multiple abandoned commands
    this.speechThreshold = 0.22; // robust threshold to avoid ambient room noise and speaker bleed
    this.isSpeaking = false;
    this.silenceTimer = null;
    this.keywords = ['friday', 'hey friday', 'hi friday', '星期五', '周五', '你好friday', '你好 friday'];
  }

  setSpeakingState(speaking) {
    this.isFridaySpeaking = speaking;
    if (speaking) {
      // Immediately cancel any partial user recording that might pick up speaker audio
      this.isSpeaking = false;
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    }
  }

  checkVoiceActivity(micEnergy) {
    if (!this.enabled || this.isMuted) return;

    // CRITICAL: If Friday is speaking, ignore microphone to prevent echo/feedback loops!
    if (this.isFridaySpeaking) return;

    // CRITICAL: If already processing a voice command, lock out new recordings until finished!
    if (this.isProcessingRecording) return;

    // Check if voice energy exceeds threshold
    if (micEnergy >= this.speechThreshold) {
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.onSpeechStart();
      }
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } else if (this.isSpeaking) {
      // Silence detected after speech
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.isSpeaking = false;
          this.silenceTimer = null;
          this.onSpeechEnd();
        }, 850); // 850ms crisp silence window
      }
    }
  }

  onSpeechStart() {
    if (this.audioCapture && !this.isFridaySpeaking && !this.isProcessingRecording) {
      this.audioCapture.startRecording();
    }
  }

  async onSpeechEnd() {
    if (!this.audioCapture || this.isFridaySpeaking || this.isProcessingRecording) return;
    
    this.isProcessingRecording = true;
    const recording = await this.audioCapture.stopRecording();
    
    if (!recording || !recording.buffer || recording.size < 4000) {
      this.isProcessingRecording = false;
      return;
    }

    try {
      const text = await window.fridayAPI.transcribeAudio(recording.buffer, recording.mimeType);
      if (!text || text.trim().length === 0) {
        this.isProcessingRecording = false;
        return;
      }

      const lower = text.trim().toLowerCase();
      console.log('Voice recognized:', lower);

      if (!this.activeSession) {
        // Check for wake word
        const matched = this.keywords.some(kw => lower.includes(kw));
        if (matched) {
          let commandRemainder = '';
          for (const kw of this.keywords) {
            const idx = lower.indexOf(kw);
            if (idx !== -1) {
              commandRemainder = lower.slice(idx + kw.length).replace(/^[,\s.!]+/, '').trim();
              break;
            }
          }
          this.onWake({ transcript: text, commandRemainder });
        }
      } else {
        // Pill is already active, forward command
        this.onSpeech({ text, isFinal: true });
      }
    } catch (e) {
      console.warn('Transcription notice:', e.message);
    } finally {
      this.isProcessingRecording = false;
    }
  }

  start() {
    this.enabled = true;
  }

  stop() {
    this.enabled = false;
  }

  setActiveSession(isActive) {
    this.activeSession = isActive;
  }

  setMuted(isMuted) {
    this.isMuted = isMuted;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

window.WakeWordDetector = WakeWordDetector;
