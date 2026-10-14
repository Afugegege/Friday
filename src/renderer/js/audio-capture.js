/**
 * Audio Capture, Real-Time Energy Analysis, and Voice Recording
 * Separates visualizer energy (visual animation) from microphone energy (voice detection)
 * to completely eliminate self-interruption and feedback loops.
 */

class AudioCapture {
  constructor() {
    this.audioCtx = null;
    this.micStream = null;
    this.micAnalyser = null;
    this.playbackAnalyser = null;
    this.isListening = false;
    this.audioDataArray = null;

    // Distinct callbacks
    this.onVisualizerCallback = null;
    this.onMicLevelCallback = null;
    this.levelIntervalId = null;

    // MediaRecorder for voice command recording
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
  }

  async initMic() {
    if (this.micStream) return true;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioCtx.createMediaStreamSource(this.micStream);

      this.micAnalyser = this.audioCtx.createAnalyser();
      this.micAnalyser.fftSize = 256;
      this.micAnalyser.smoothingTimeConstant = 0.4;

      source.connect(this.micAnalyser);

      const bufferLength = this.micAnalyser.frequencyBinCount;
      this.audioDataArray = new Uint8Array(bufferLength);

      return true;
    } catch (err) {
      console.warn('Microphone access unavailable or denied:', err.message);
      return false;
    }
  }

  startMonitoring(onVisualizerLevel, onMicLevel) {
    this.onVisualizerCallback = onVisualizerLevel;
    this.onMicLevelCallback = onMicLevel;
    this.isListening = true;

    if (this.levelIntervalId) clearInterval(this.levelIntervalId);

    this.levelIntervalId = setInterval(() => {
      if (!this.isListening) return;

      let micEnergy = 0;
      let playbackEnergy = 0;

      // 1. Measure pure microphone input
      if (this.micAnalyser && this.audioDataArray) {
        this.micAnalyser.getByteFrequencyData(this.audioDataArray);
        let sum = 0;
        for (let i = 0; i < this.audioDataArray.length; i++) {
          sum += this.audioDataArray[i];
        }
        const avg = sum / this.audioDataArray.length;
        micEnergy = Math.pow(avg / 120, 1.3);
      }

      // 2. Measure TTS output playback (solely for waveform animation)
      if (this.playbackAnalyser) {
        const pArray = new Uint8Array(this.playbackAnalyser.frequencyBinCount);
        this.playbackAnalyser.getByteFrequencyData(pArray);
        let pSum = 0;
        for (let i = 0; i < pArray.length; i++) {
          pSum += pArray[i];
        }
        const pAvg = pSum / pArray.length;
        playbackEnergy = Math.pow(pAvg / 110, 1.2);
      }

      // Visualizer gets both so curves dance to input & output
      const visualizerLevel = Math.min(1.0, Math.max(micEnergy, playbackEnergy));
      if (this.onVisualizerCallback) {
        this.onVisualizerCallback(visualizerLevel);
      }

      // Voice Activity Detector gets ONLY pure microphone input!
      if (this.onMicLevelCallback) {
        this.onMicLevelCallback(Math.min(1.0, micEnergy));
      }
    }, 30);
  }

  stopMonitoring() {
    this.isListening = false;
    if (this.levelIntervalId) {
      clearInterval(this.levelIntervalId);
      this.levelIntervalId = null;
    }
  }

  startRecording() {
    if (!this.micStream || this.isRecording) return;
    this.recordedChunks = [];

    const options = { mimeType: 'audio/webm' };
    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      if (MediaRecorder.isTypeSupported('audio/mp4')) options.mimeType = 'audio/mp4';
      else options.mimeType = '';
    }

    try {
      this.mediaRecorder = new MediaRecorder(this.micStream, options);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };
      this.mediaRecorder.start(100);
      this.isRecording = true;
    } catch (e) {
      console.warn('Failed to start MediaRecorder:', e.message);
    }
  }

  async stopRecording() {
    if (!this.mediaRecorder || !this.isRecording) return null;

    return new Promise((resolve) => {
      this.mediaRecorder.onstop = async () => {
        this.isRecording = false;
        if (this.recordedChunks.length === 0) {
          resolve(null);
          return;
        }

        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        const arrayBuffer = await blob.arrayBuffer();
        resolve({
          buffer: arrayBuffer,
          mimeType,
          size: blob.size
        });
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        this.isRecording = false;
        resolve(null);
      }
    });
  }

  /**
   * Connect an HTML Audio element to the playback analyser
   */
  connectAudioElement(audioElement) {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    try {
      const source = this.audioCtx.createMediaElementSource(audioElement);
      this.playbackAnalyser = this.audioCtx.createAnalyser();
      this.playbackAnalyser.fftSize = 256;
      this.playbackAnalyser.smoothingTimeConstant = 0.6;

      source.connect(this.playbackAnalyser);
      this.playbackAnalyser.connect(this.audioCtx.destination);
    } catch (e) {
      console.warn('Playback audio source connection notice:', e.message);
    }
  }

  disconnect() {
    this.stopMonitoring();
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}

window.AudioCapture = AudioCapture;
