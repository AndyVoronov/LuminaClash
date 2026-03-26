/**
 * AudioManager — synthesized sound effects via Web Audio API.
 * No external files needed. All sounds are generated procedurally.
 *
 * Categories: SFX (game sounds), Music (ambient loop), UI (clicks).
 */

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // Volume (0..1)
  private _masterVol = 0.5;
  private _musicVol = 0.3;
  private _sfxVol = 0.6;

  // Music state
  private musicOscs: OscillatorNode[] = [];
  private musicPlaying = false;

  // Cooldowns to prevent sound spam
  private lastPlay: Map<string, number> = new Map();
  private cooldowns: Record<string, number> = {
    capture: 80,
    decay: 200,
    obstaclePlace: 150,
    obstacleDissolve: 100,
    powerUpPickup: 300,
    powerUpActivate: 200,
    menuClick: 100,
    menuHover: 80,
    timerTick: 300,
    countdown: 800,
  };

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = this._masterVol;

      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.musicGain.gain.value = this._musicVol;

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);
      this.sfxGain.gain.value = this._sfxVol;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // ── Volume controls ──

  get masterVol(): number { return this._masterVol; }
  get musicVol(): number { return this._musicVol; }
  get sfxVol(): number { return this._sfxVol; }

  set masterVol(v: number) {
    this._masterVol = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this._masterVol;
  }

  set musicVol(v: number) {
    this._musicVol = Math.max(0, Math.min(1, v));
    if (this.musicGain) this.musicGain.gain.value = this._musicVol;
  }

  set sfxVol(v: number) {
    this._sfxVol = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this._sfxVol;
  }

  // ── Cooldown check ──

  private canPlay(name: string): boolean {
    const now = Date.now();
    const last = this.lastPlay.get(name) ?? 0;
    const cd = this.cooldowns[name] ?? 100;
    if (now - last < cd) return false;
    this.lastPlay.set(name, now);
    return true;
  }

  // ── SFX ──

  playCapture(territoryPercent: number = 50): void {
    if (!this.canPlay('capture')) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Soft chime, pitch rises with territory size
    const baseFreq = 600 + territoryPercent * 4;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.2, t + 0.08);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playDecay(): void {
    if (!this.canPlay('decay')) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Low hum
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.2);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  playObstaclePlace(): void {
    if (!this.canPlay('obstaclePlace')) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Solid click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.08);

    // Sub click
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(500, t + 0.02);
    gain2.gain.setValueAtTime(0.05, t + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain!);
    osc2.start(t + 0.02);
    osc2.stop(t + 0.06);
  }

  playObstacleDissolve(): void {
    if (!this.canPlay('obstacleDissolve')) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Crumble noise via detuned oscillators
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150 + i * 80, t);
      osc.frequency.exponentialRampToValueAtTime(60 + i * 30, t + 0.2);
      gain.gain.setValueAtTime(0.03, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t + i * 0.03);
      osc.stop(t + 0.25);
    }
  }

  playPowerUpPickup(): void {
    if (!this.canPlay('powerUpPickup')) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Memorable arpeggio
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], t + i * 0.06);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.15);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.15);
    }
  }

  playPowerUpActivate(): void {
    if (!this.canPlay('powerUpActivate')) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // WHOOSH — filtered noise
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(3000, t + 0.1);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.25);
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    noise.start(t);
    noise.stop(t + 0.25);
  }

  playBomb(): void {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Low explosion
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.5);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.5);

    // Crackle noise
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.15, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    noise.connect(ng);
    ng.connect(this.sfxGain!);
    noise.start(t);
    noise.stop(t + 0.3);
  }

  playMatchStart(): void {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Ascending tone
    const notes = [262, 330, 392, 523]; // C4, E4, G4, C5
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], t + i * 0.1);
      gain.gain.setValueAtTime(0.08, t + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.2);
    }
  }

  playVictory(): void {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Fanfare
    const melody = [523, 659, 784, 1047, 784, 1047]; // C5 E5 G5 C6 G5 C6
    const durations = [0.12, 0.12, 0.12, 0.25, 0.12, 0.4];
    let offset = 0;
    for (let i = 0; i < melody.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(melody[i], t + offset);
      gain.gain.setValueAtTime(0.1, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + durations[i] * 0.9);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t + offset);
      osc.stop(t + offset + durations[i]);
      offset += durations[i] * 0.8;
    }

    // Sustained pad underneath
    const pad = ctx.createOscillator();
    const padGain = ctx.createGain();
    pad.type = 'sine';
    pad.frequency.setValueAtTime(523, t); // C5
    padGain.gain.setValueAtTime(0, t);
    padGain.gain.linearRampToValueAtTime(0.04, t + 0.3);
    padGain.gain.linearRampToValueAtTime(0.001, t + 1.5);
    pad.connect(padGain);
    padGain.connect(this.sfxGain!);
    pad.start(t);
    pad.stop(t + 1.5);
  }

  playDefeat(): void {
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    // Descending minor sting
    const melody = [440, 370, 311, 262]; // A4 Ab4 Eb4 C4
    for (let i = 0; i < melody.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(melody[i], t + i * 0.2);
      gain.gain.setValueAtTime(0.08, t + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.2 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t + i * 0.2);
      osc.stop(t + i * 0.2 + 0.35);
    }
  }

  playTimerTick(urgent: boolean = false): void {
    if (!this.canPlay(urgent ? 'countdown' : 'timerTick')) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(urgent ? 880 : 600, t);
    gain.gain.setValueAtTime(urgent ? 0.1 : 0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (urgent ? 0.15 : 0.08));
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + (urgent ? 0.15 : 0.08));
  }

  playMenuClick(): void {
    if (!this.canPlay('menuClick')) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  playMenuHover(): void {
    if (!this.canPlay('menuHover')) return;
    const ctx = this.ensureContext();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    gain.gain.setValueAtTime(0.02, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  // ── Music ──

  startMusic(): void {
    if (this.musicPlaying) return;
    const ctx = this.ensureContext();
    this.musicPlaying = true;

    // Ambient drone — two detuned sine waves with slow LFO modulation
    const baseFreq = 110; // A2

    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * (1 + i * 0.5), ctx.currentTime);
      // Slow pitch drift
      osc.frequency.linearRampToValueAtTime(
        baseFreq * (1 + i * 0.5) * (1 + Math.sin(i * 1.5) * 0.02),
        ctx.currentTime + 30,
      );

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400 + i * 200, ctx.currentTime);
      filter.Q.value = 1;

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.03 / (i + 1), ctx.currentTime + 2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain!);
      osc.start();
      this.musicOscs.push(osc);
    }

    // Pad chord — Am7 (A C E G)
    const padNotes = [220, 262, 330, 392];
    for (const freq of padNotes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 3);

      osc.connect(gain);
      gain.connect(this.musicGain!);
      osc.start();
      this.musicOscs.push(osc);
    }
  }

  intensifyMusic(): void {
    // Raise filter cutoff and gain for last 30 seconds
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.linearRampToValueAtTime(this._musicVol * 1.8, t + 2);
  }

  stopMusic(): void {
    for (const osc of this.musicOscs) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    this.musicOscs = [];
    this.musicPlaying = false;
  }

  // ── Lifecycle ──

  destroy(): void {
    this.stopMusic();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
