class SoundAlertService {
  private audioCtx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private intervalId: any = null;
  private isPlaying: boolean = false;
  private muted: boolean = false;
  private toneToggle: boolean = false;
  private listeners: Set<(muted: boolean, isPlaying: boolean) => void> = new Set();

  constructor() {
    // Check localStorage for saved mute preference
    const saved = localStorage.getItem('riskguard_siren_muted');
    if (saved !== null) {
      this.muted = saved === 'true';
    }
  }

  private initAudio() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    localStorage.setItem('riskguard_siren_muted', String(mute));
    if (this.muted && this.isPlaying) {
      this.stopSiren();
    }
    this.notify();
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public subscribe(cb: (muted: boolean, isPlaying: boolean) => void): () => void {
    this.listeners.add(cb);
    cb(this.muted, this.isPlaying);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.muted, this.isPlaying));
  }

  public startSiren() {
    if (this.muted || this.isPlaying) return;

    try {
      this.initAudio();
      if (!this.audioCtx) return;

      this.oscillator = this.audioCtx.createOscillator();
      this.gainNode = this.audioCtx.createGain();

      this.oscillator.type = 'sawtooth';
      this.oscillator.frequency.setValueAtTime(800, this.audioCtx.currentTime);

      // Controlled volume
      this.gainNode.gain.setValueAtTime(0.15, this.audioCtx.currentTime);

      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);

      this.oscillator.start();
      this.isPlaying = true;
      this.toneToggle = false;

      // Two-tone alternating frequency: 800Hz / 1200Hz pulsing oscillator every 250ms
      this.intervalId = setInterval(() => {
        if (!this.audioCtx || !this.oscillator) return;
        this.toneToggle = !this.toneToggle;
        const targetFreq = this.toneToggle ? 1200 : 800;
        this.oscillator.frequency.setTargetAtTime(targetFreq, this.audioCtx.currentTime, 0.05);
      }, 250);

      this.notify();
    } catch (err) {
      console.warn('Web Audio API siren error:', err);
    }
  }

  public stopSiren() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.oscillator) {
      try {
        if (this.audioCtx && this.gainNode) {
          // Fade out quickly to avoid clicks
          this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioCtx.currentTime);
          this.gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.05);
        }
        setTimeout(() => {
          try {
            this.oscillator?.stop();
            this.oscillator?.disconnect();
            this.oscillator = null;
          } catch {
            // Ignore if already stopped
          }
        }, 60);
      } catch {
        this.oscillator = null;
      }
    }
    this.isPlaying = false;
    this.notify();
  }

  public updateAlarmState(activeCriticalCount: number) {
    if (activeCriticalCount > 0 && !this.muted) {
      if (!this.isPlaying) {
        this.startSiren();
      }
    } else {
      if (this.isPlaying) {
        this.stopSiren();
      }
    }
  }

  public playTestBeep() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.2);
    } catch (err) {
      console.warn('Test beep error:', err);
    }
  }
}

export const soundAlert = new SoundAlertService();
