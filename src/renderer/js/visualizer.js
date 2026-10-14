/**
 * FRIDAY Signature Multi-Layer Waveform Visualizer
 * Renders 36-48 fine, overlapping curved lines forming an organic,
 * flowing harmonic waveform driven by real-time audio measurements.
 */

class WaveformVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    
    // Canvas sizing
    this.dpr = window.devicePixelRatio || 1;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.setupCanvasDpi();

    // Wave configuration
    this.numCurves = 42; // 36-48 fine overlapping curves
    this.curves = [];
    this.phase = 0;
    this.baseSpeed = 0.018;
    this.targetSpeed = 0.018;

    // Audio responsiveness
    this.audioEnergy = 0.05; // current smoothed audio level (0 to 1)
    this.targetAudioEnergy = 0.05;
    this.state = 'idle'; // 'idle', 'listening', 'processing', 'speaking', 'error'
    
    this.isRunning = false;
    this.animationFrameId = null;

    this.initCurves();
  }

  setupCanvasDpi() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 280;
    const h = rect.height || 60;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
    this.width = w;
    this.height = h;
  }

  initCurves() {
    this.curves = [];
    for (let i = 0; i < this.numCurves; i++) {
      const progress = i / (this.numCurves - 1); // 0 to 1
      // Distribute curve attributes symmetrically around the center
      const centerDist = Math.abs(progress - 0.5) * 2; // 0 at center, 1 at edges
      
      this.curves.push({
        index: i,
        phaseOffset: i * 0.14,
        freqFactor: 1.0 + (i % 5) * 0.12 - 0.24,
        harmonicFactor: 2.2 + (i % 3) * 0.3,
        // Center curves have higher amplitude and brighter opacity
        amplitudeScale: 1.0 - centerDist * 0.5,
        alpha: Math.max(0.08, 0.42 - centerDist * 0.32),
        // Slight line thickness variation
        lineWidth: 0.6 + (1 - centerDist) * 0.6
      });
    }
  }

  setState(state) {
    this.state = state;
    if (state === 'processing') {
      this.targetSpeed = 0.038;
      this.targetAudioEnergy = 0.25;
    } else if (state === 'listening') {
      this.targetSpeed = 0.022;
      this.targetAudioEnergy = 0.08;
    } else if (state === 'speaking') {
      this.targetSpeed = 0.032;
    } else if (state === 'error') {
      this.targetSpeed = 0.012;
      this.targetAudioEnergy = 0.1;
    } else {
      this.targetSpeed = 0.015;
      this.targetAudioEnergy = 0.03;
    }
  }

  updateAudioEnergy(normalizedLevel) {
    // Smooth peak follower
    const level = Math.max(0, Math.min(1, normalizedLevel));
    if (level > this.targetAudioEnergy) {
      this.targetAudioEnergy = level; // fast attack
    } else {
      this.targetAudioEnergy = this.targetAudioEnergy * 0.9 + level * 0.1; // slow decay
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.render();
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  render() {
    if (!this.isRunning) return;

    this.ctx.clearRect(0, 0, this.width, this.height);

    // Interpolate audio energy and speed smoothly
    this.audioEnergy += (this.targetAudioEnergy - this.audioEnergy) * 0.12;
    this.baseSpeed += (this.targetSpeed - this.baseSpeed) * 0.08;
    this.phase += this.baseSpeed;

    const centerY = this.height / 2;
    // Base amplitude depends on state and audio energy
    const maxAmplitude = (this.height * 0.44) * (0.15 + this.audioEnergy * 0.85);

    // Choose curve stroke color palette
    let strokeColor = { r: 220, g: 240, b: 255 }; // Cool luminous white/cyan
    if (this.state === 'error') {
      strokeColor = { r: 255, g: 140, b: 170 }; // Soft rose
    } else if (this.state === 'processing') {
      strokeColor = { r: 235, g: 235, b: 255 }; // Crisp ethereal white
    }

    const pointsCount = 48;
    const stepX = this.width / (pointsCount - 1);

    // Render each curve
    for (const curve of this.curves) {
      this.ctx.beginPath();
      this.ctx.lineWidth = curve.lineWidth;
      
      // Dynamic alpha boosted slightly by speech energy
      const effectiveAlpha = Math.min(0.85, curve.alpha * (0.85 + this.audioEnergy * 0.8));
      this.ctx.strokeStyle = `rgba(${strokeColor.r}, ${strokeColor.g}, ${strokeColor.b}, ${effectiveAlpha})`;

      const curvePhase = this.phase + curve.phaseOffset;
      const amp = maxAmplitude * curve.amplitudeScale;

      for (let j = 0; j < pointsCount; j++) {
        const x = j * stepX;
        const normalizedX = x / this.width; // 0 to 1

        // Smooth Hanning-style envelope tapering edges to 0
        const envelope = Math.sin(normalizedX * Math.PI);
        const shapedEnvelope = Math.pow(envelope, 1.6);

        // Multi-frequency wave components with slight asymmetry
        const wave1 = Math.sin(normalizedX * Math.PI * 2.5 * curve.freqFactor + curvePhase);
        const wave2 = Math.sin(normalizedX * Math.PI * 4.2 * curve.freqFactor - curvePhase * 0.8);
        const wave3 = Math.cos(normalizedX * Math.PI * 1.5 + curvePhase * 1.2) * 0.35;

        // Combined organic displacement
        const yOffset = (wave1 * 0.65 + wave2 * 0.25 + wave3) * amp * shapedEnvelope;
        const y = centerY + yOffset;

        if (j === 0) {
          this.ctx.moveTo(x, y);
        } else {
          // Smooth curve using quad interpolation
          const prevX = (j - 1) * stepX;
          const midX = (prevX + x) / 2;
          this.ctx.quadraticCurveTo(prevX, y, midX, y);
        }
      }

      this.ctx.stroke();
    }

    this.animationFrameId = requestAnimationFrame(() => this.render());
  }
}

window.WaveformVisualizer = WaveformVisualizer;
