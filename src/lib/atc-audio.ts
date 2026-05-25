export class ATCAudioEngine {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private isRunning = false;
  private squelchInterval: ReturnType<typeof setInterval> | null = null;

  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(this.ctx.destination);
  }

  private createNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }
    // Band-pass style: reduce low/high frequencies for radio effect
    for (let i = 1; i < bufferSize - 1; i++) {
      data[i] = data[i] * 0.5 + data[i - 1] * 0.25 + data[i + 1] * 0.25;
    }
    return buffer;
  }

  private playSquelchTone(duration: number = 0.08) {
    if (!this.ctx || !this.gainNode) return;
    const osc = this.ctx.createOscillator();
    const sqGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1800 + Math.random() * 400;
    sqGain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    sqGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(sqGain);
    sqGain.connect(this.gainNode);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playTransmission() {
    if (!this.ctx || !this.gainNode || !this.isRunning) return;
    const duration = 1.5 + Math.random() * 5;
    // Squelch open
    this.playSquelchTone(0.1);
    // Boost static during "transmission"
    const staticGain = this.ctx.createGain();
    const staticOsc = this.ctx.createOscillator();
    staticOsc.type = 'sawtooth';
    staticOsc.frequency.value = 200 + Math.random() * 600;
    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 800 + Math.random() * 1200;
    bandpass.Q.value = 2 + Math.random() * 3;
    staticGain.gain.setValueAtTime(0, this.ctx.currentTime);
    staticGain.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.03, this.ctx.currentTime + 0.15);
    staticGain.gain.setValueAtTime(0.04 + Math.random() * 0.03, this.ctx.currentTime + duration - 0.15);
    staticGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
    staticOsc.connect(bandpass);
    bandpass.connect(staticGain);
    staticGain.connect(this.gainNode);
    staticOsc.start();
    staticOsc.stop(this.ctx.currentTime + duration);
    // Simulate voice-like modulation
    const voiceGain = this.ctx.createGain();
    const voice1 = this.ctx.createOscillator();
    const voice2 = this.ctx.createOscillator();
    voice1.type = 'sawtooth';
    voice2.type = 'square';
    voice1.frequency.value = 120 + Math.random() * 80;
    voice2.frequency.value = 200 + Math.random() * 100;
    const voiceBand = this.ctx.createBiquadFilter();
    voiceBand.type = 'bandpass';
    voiceBand.frequency.value = 1000 + Math.random() * 800;
    voiceBand.Q.value = 5;
    // LFO for speech rhythm
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 3 + Math.random() * 4;
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(voiceGain.gain);
    voiceGain.gain.setValueAtTime(0, this.ctx.currentTime);
    voiceGain.gain.linearRampToValueAtTime(0.025, this.ctx.currentTime + 0.2);
    voiceGain.gain.setValueAtTime(0.025, this.ctx.currentTime + duration - 0.2);
    voiceGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
    voice1.connect(voiceBand);
    voice2.connect(voiceBand);
    voiceBand.connect(voiceGain);
    voiceGain.connect(this.gainNode);
    voice1.start();
    voice2.start();
    lfo.start();
    voice1.stop(this.ctx.currentTime + duration);
    voice2.stop(this.ctx.currentTime + duration);
    lfo.stop(this.ctx.currentTime + duration);
    // Squelch close
    setTimeout(() => this.playSquelchTone(0.06), duration * 1000);
  }

  start(volume: number = 0.7) {
    this.init();
    if (this.isRunning) return;
    this.isRunning = true;
    if (!this.ctx || !this.gainNode) return;
    // Background static
    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = this.createNoise();
    this.noiseNode.loop = true;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.03 * volume;
    const noiseBand = this.ctx.createBiquadFilter();
    noiseBand.type = 'bandpass';
    noiseBand.frequency.value = 2000;
    noiseBand.Q.value = 0.8;
    this.noiseNode.connect(noiseBand);
    noiseBand.connect(noiseGain);
    noiseGain.connect(this.gainNode);
    this.noiseNode.start();
    this.gainNode.gain.value = volume;
    // Periodic transmissions
    const scheduleNext = () => {
      if (!this.isRunning) return;
      const delay = 2000 + Math.random() * 8000;
      this.squelchInterval = setTimeout(() => {
        if (this.isRunning) {
          this.playTransmission();
          scheduleNext();
        }
      }, delay);
    };
    scheduleNext();
    // Initial transmission after short delay
    setTimeout(() => { if (this.isRunning) this.playTransmission(); }, 500);
  }

  stop() {
    this.isRunning = false;
    if (this.noiseNode) {
      try { this.noiseNode.stop(); } catch {}
      this.noiseNode = null;
    }
    if (this.squelchInterval) {
      clearTimeout(this.squelchInterval);
      this.squelchInterval = null;
    }
    if (this.gainNode) this.gainNode.gain.value = 0;
  }

  setVolume(vol: number) {
    if (this.gainNode) this.gainNode.gain.value = vol;
  }

  destroy() {
    this.stop();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
