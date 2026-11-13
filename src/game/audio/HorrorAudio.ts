import type { GameSettings, MonsterCategoryId, WeaponId } from '../types';

export class HorrorAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private tensionFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;

  private initialized = false;
  private threatLevel = 0;
  private ambientTimer = 0;

  private settings: GameSettings = {
    masterVolume: 0.75,
    musicVolume: 0.65,
    sfxVolume: 0.85,
    muted: false,
    mouseSensitivity: 1.0,
    defaultCamera: 'third_person',
    graphicsQuality: 'high',
    showTouchControls: 'auto',
  };

  public updateSettings(next: GameSettings): void {
    this.settings = { ...next };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const master = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain.gain.setTargetAtTime(master, now, 0.05);
    this.musicGain.gain.setTargetAtTime(this.settings.musicVolume, now, 0.08);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, now, 0.05);
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applyVolumes();
      this.startAmbientLayers();
      this.initialized = true;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private createNoiseBuffer(seconds = 2): AudioBuffer | null {
    if (!this.ctx) return null;
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.08;
    }
    return buffer;
  }

  private startAmbientLayers(): void {
    if (!this.ctx || !this.musicGain) return;

    // Dark horror sub-drone
    this.tensionFilter = this.ctx.createBiquadFilter();
    this.tensionFilter.type = 'lowpass';
    this.tensionFilter.frequency.value = 180;
    this.tensionFilter.Q.value = 3.5;

    const droneAmp = this.ctx.createGain();
    droneAmp.gain.value = 0.18;

    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sawtooth';
    this.droneOsc1.frequency.value = 46.25; // F#1 eerie drone

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'triangle';
    this.droneOsc2.frequency.value = 69.3; // C#2 fifth / dissonant drift

    this.droneOsc1.connect(this.tensionFilter);
    this.droneOsc2.connect(this.tensionFilter);
    this.tensionFilter.connect(droneAmp);
    droneAmp.connect(this.musicGain);

    this.droneOsc1.start();
    this.droneOsc2.start();

    // Rain / wind noise loop
    const noiseBuf = this.createNoiseBuffer(3);
    if (noiseBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;

      this.rainFilter = this.ctx.createBiquadFilter();
      this.rainFilter.type = 'bandpass';
      this.rainFilter.frequency.value = 950;
      this.rainFilter.Q.value = 0.65;

      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0.12;

      src.connect(this.rainFilter);
      this.rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.musicGain);
      src.start();
    }
  }

  public setEnvironmentAudio(hasRain: boolean, isIndoor: boolean): void {
    if (!this.ctx || !this.rainGain || !this.rainFilter) return;
    const now = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(hasRain ? 0.24 : isIndoor ? 0.06 : 0.12, now, 0.3);
    this.rainFilter.frequency.setTargetAtTime(hasRain ? 1350 : isIndoor ? 280 : 620, now, 0.3);
  }

  public setThreatLevel(level: number, dt: number): void {
    this.threatLevel = Math.max(0, Math.min(1, level));
    if (!this.initialized || !this.ctx || !this.tensionFilter || !this.droneOsc2) return;
    const now = this.ctx.currentTime;
    this.tensionFilter.frequency.setTargetAtTime(160 + this.threatLevel * 520, now, 0.15);
    this.droneOsc2.frequency.setTargetAtTime(69.3 + this.threatLevel * 3.8, now, 0.2);

    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 6 + Math.random() * 7;
      if (this.threatLevel > 0.25) {
        this.playDistantCreatureNoise();
      }
    }
  }

  public playMissionIntro(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = [110, 130.81, 164.81, 220];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.16, now + idx * 0.14 + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 1.1);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 1.15);
    });
  }

  public playThunder(): void {
    if (!this.ctx || !this.sfxGain) return;
    const buf = this.createNoiseBuffer(1.8);
    if (!buf) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);
    filter.frequency.exponentialRampToValueAtTime(55, now + 1.6);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.7);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
  }

  public playDistantCreatureNoise(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    const startFreq = 180 + Math.random() * 140;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 0.55, now + 0.75);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 480;
    filter.Q.value = 5;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.85);
  }

  public playFootstep(isMonster = false, volumeScale = 1): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isMonster ? 68 : 95, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.09);

    gain.gain.setValueAtTime(0.08 * Math.min(1, volumeScale), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playAttack(weaponId: WeaponId): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (weaponId === 'solaris_repeater' || weaponId === 'aegis_lance') {
      osc.type = weaponId === 'aegis_lance' ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(weaponId === 'aegis_lance' ? 520 : 740, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.16);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(weaponId === 'umbral_scythe' ? 190 : 280, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.15);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    }

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playHit(heavy = false): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(heavy ? 160 : 220, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.12);
    gain.gain.setValueAtTime(heavy ? 0.28 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playMonsterGrowl(category: MonsterCategoryId): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    const base =
      category === 'boss_sovereign' || category === 'boss_warden'
        ? 72
        : category === 'mutated_beast'
          ? 88
          : 155;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.linearRampToValueAtTime(base * 0.72, now + 0.35);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playPlayerHurt(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.22);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playFlare(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.22);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.48);
  }

  public playDiscover(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.14, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.38);
    });
  }

  public playVictory(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    [293.66, 369.99, 440, 587.33].forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.16, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.9);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.95);
    });
  }

  public playDefeat(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    [220, 196, 155.56, 110].forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.18);
      gain.gain.setValueAtTime(0.12, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.7);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.75);
    });
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.initialized = false;
    }
  }
}
