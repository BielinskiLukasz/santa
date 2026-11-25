// Generative sound for the clearing (PHASE-6, UI-SPEC §9): one AudioContext started
// only after a user gesture, a quiet pentatonic music-box loop with generated reverb,
// campfire crackle from filtered noise, and a few identical-for-everyone effects.
// No audio files are shipped; everything is synthesized. Effects never depend on the
// draw result, so they cannot leak who drew whom.

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
  setTargetAtTime(value: number, time: number, constant: number): unknown;
}

export interface GainLike {
  gain: AudioParamLike;
  connect(destination: unknown): unknown;
}

export interface OscillatorLike {
  type: string;
  frequency: AudioParamLike;
  connect(destination: unknown): unknown;
  start(time?: number): void;
  stop(time?: number): void;
}

export interface BufferSourceLike {
  buffer: unknown;
  loop: boolean;
  playbackRate: AudioParamLike;
  connect(destination: unknown): unknown;
  start(time?: number, offset?: number): void;
  stop(time?: number): void;
}

export interface FilterLike {
  type: string;
  frequency: AudioParamLike;
  Q: AudioParamLike;
  connect(destination: unknown): unknown;
}

export interface ConvolverLike {
  buffer: unknown;
  connect(destination: unknown): unknown;
}

export interface AudioBufferLike {
  getChannelData(channel: number): Float32Array;
}

export interface AudioContextLike {
  currentTime: number;
  state: string;
  sampleRate: number;
  destination: unknown;
  createGain(): GainLike;
  createOscillator(): OscillatorLike;
  createBufferSource(): BufferSourceLike;
  createBiquadFilter(): FilterLike;
  createConvolver(): ConvolverLike;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike;
  resume(): Promise<void>;
  suspend(): Promise<void>;
}

export interface SoundEngineOptions {
  readonly createContext?: () => AudioContextLike | null;
  readonly muted?: boolean;
  readonly random?: () => number;
  readonly setInterval?: (handler: () => void, ms: number) => number;
  readonly clearInterval?: (id: number) => void;
}

// C major pentatonic across two octaves — a music box cannot hit a sad note.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
const BASS = [130.81, 98];
const TICK_MS = 200;
const LOOKAHEAD_S = 0.7;
const STEP_S = 0.38;

function defaultContext(): AudioContextLike | null {
  const Ctor =
    globalThis.AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? (new Ctor() as unknown as AudioContextLike) : null;
}

export class SoundEngine {
  private context: AudioContextLike | null = null;
  private master: GainLike | null = null;
  private musicBus: GainLike | null = null;
  private sfxBus: GainLike | null = null;
  private noiseBuffer: AudioBufferLike | null = null;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private scaleIndex = 3;
  private stepCount = 0;
  private started = false;
  private muted: boolean;
  private readonly createContext: () => AudioContextLike | null;
  private readonly random: () => number;
  private readonly setIntervalFn: (handler: () => void, ms: number) => number;
  private readonly clearIntervalFn: (id: number) => void;

  constructor(options: SoundEngineOptions = {}) {
    this.createContext = options.createContext ?? defaultContext;
    this.muted = options.muted ?? false;
    this.random = options.random ?? Math.random;
    this.setIntervalFn = options.setInterval ?? ((handler, ms) => window.setInterval(handler, ms));
    this.clearIntervalFn = options.clearInterval ?? ((id) => window.clearInterval(id));
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get isStarted(): boolean {
    return this.started;
  }

  // Call from a user gesture (entering the password). Creates the single context,
  // resumes it and starts the music box and the campfire. Safe to call repeatedly.
  async unlock(): Promise<void> {
    if (this.context === null) {
      this.context = this.createContext();
      if (this.context === null) return;
      this.buildGraph();
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.startAmbience();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, 0.05);
    }
  }

  // Hidden tabs go silent (UI-SPEC §9); visible tabs resume if the engine runs.
  async setDocumentHidden(hidden: boolean): Promise<void> {
    if (this.context === null || !this.started) return;
    if (hidden) {
      await this.context.suspend();
    } else if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  private buildGraph(): void {
    const ctx = this.context as AudioContextLike;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.4;
    this.musicBus.connect(this.master);

    // Generated impulse reverb: decaying noise, no external files.
    const convolver = ctx.createConvolver();
    convolver.buffer = this.impulse(1.8, 2.6);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.5;
    this.musicBus.connect(convolver);
    convolver.connect(reverbGain);
    reverbGain.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    // Shared white-noise buffer for fire and paper sounds.
    const length = ctx.sampleRate * 2;
    this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = this.random() * 2 - 1;
  }

  private impulse(durationS: number, decay: number): AudioBufferLike {
    const ctx = this.context as AudioContextLike;
    const length = Math.floor(ctx.sampleRate * durationS);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        data[index] = (this.random() * 2 - 1) * (1 - index / length) ** decay;
      }
    }
    return buffer;
  }

  private startAmbience(): void {
    if (this.started || this.context === null) return;
    this.started = true;
    const ctx = this.context;

    // Soft fire bed: looped noise through a low pass filter.
    const bed = ctx.createBufferSource();
    bed.buffer = this.noiseBuffer;
    bed.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 320;
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.014;
    bed.connect(lowpass);
    lowpass.connect(bedGain);
    bedGain.connect(this.master);
    bed.start();

    this.nextNoteTime = ctx.currentTime + 0.15;
    this.timer = this.setIntervalFn(() => this.tick(), TICK_MS);
  }

  private tick(): void {
    const ctx = this.context;
    if (ctx === null) return;
    while (this.nextNoteTime < ctx.currentTime + LOOKAHEAD_S) {
      this.scheduleStep(this.nextNoteTime);
      const pause = this.random() < 0.18 ? STEP_S : 0;
      this.nextNoteTime += STEP_S + pause;
    }
    // Random fire crackles between the notes.
    if (this.random() < 0.5) this.crackle();
  }

  private scheduleStep(time: number): void {
    this.stepCount += 1;
    // Random-walk melody; occasional rest keeps it calm.
    const walk = [-2, -1, -1, 0, 1, 1, 2][Math.floor(this.random() * 7)] as number;
    this.scaleIndex = Math.max(0, Math.min(SCALE.length - 1, this.scaleIndex + walk));
    if (this.random() > 0.14) {
      this.musicNote(SCALE[this.scaleIndex] as number, time, 0.11 + this.random() * 0.05, 1.5);
    }
    if (this.stepCount % 6 === 0) {
      this.musicNote(BASS[(this.stepCount / 6) % 2] as number, time, 0.045, 2.4);
    }
  }

  private musicNote(frequency: number, time: number, velocity: number, decayS: number): void {
    const ctx = this.context as AudioContextLike;
    const voice = ctx.createGain();
    voice.gain.setValueAtTime(0, time);
    voice.gain.linearRampToValueAtTime(velocity, time + 0.008);
    voice.gain.exponentialRampToValueAtTime(0.0001, time + decayS);
    const fundamental = ctx.createOscillator();
    fundamental.type = 'sine';
    fundamental.frequency.value = frequency;
    const harmonic = ctx.createOscillator();
    harmonic.type = 'sine';
    harmonic.frequency.value = frequency * 3;
    const harmonicGain = ctx.createGain();
    harmonicGain.gain.value = 0.25;
    fundamental.connect(voice);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(voice);
    voice.connect(this.musicBus);
    fundamental.start(time);
    harmonic.start(time);
    fundamental.stop(time + decayS + 0.1);
    harmonic.stop(time + decayS + 0.1);
  }

  private crackle(): void {
    const ctx = this.context;
    if (ctx === null || this.master === null) return;
    const time = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = 0.7 + this.random() * 0.6;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1300 + this.random() * 1400;
    bandpass.Q.value = 1.1;
    const gain = ctx.createGain();
    const peak = 0.02 + this.random() * 0.05;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05 + this.random() * 0.05);
    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.master);
    source.start(time, this.random() * 1.5);
    source.stop(time + 0.15);
  }

  /** Paper rustle as the envelope leaves the hat. Identical for every draw. */
  envelopeRustle(): void {
    const ctx = this.context;
    if (ctx === null || !this.started || this.sfxBus === null) return;
    const time = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = 0.9 + this.random() * 0.2;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.Q.value = 0.9;
    bandpass.frequency.setValueAtTime(800, time);
    bandpass.frequency.linearRampToValueAtTime(2600, time + 0.22);
    bandpass.frequency.linearRampToValueAtTime(1200, time + 0.4);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.16, time + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);
    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.sfxBus);
    source.start(time, this.random());
    source.stop(time + 0.45);
  }

  /** Soft wax-seal "plum" when the reveal session begins. Identical for every draw. */
  sealPlop(): void {
    const ctx = this.context;
    if (ctx === null || !this.started || this.sfxBus === null) return;
    const time = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, time);
    osc.frequency.exponentialRampToValueAtTime(82, time + 0.16);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(time);
    osc.stop(time + 0.26);
  }

  /** A small sleigh bell for the finale. Only ever plays when everyone has drawn. */
  celebrationBell(): void {
    const ctx = this.context;
    if (ctx === null || !this.started || this.sfxBus === null) return;
    const start = ctx.currentTime;
    [1046.5, 1318.51, 1567.98].forEach((frequency, index) => {
      const time = start + index * 0.16;
      const voice = ctx.createGain();
      voice.gain.setValueAtTime(0, time);
      voice.gain.linearRampToValueAtTime(0.12, time + 0.006);
      voice.gain.exponentialRampToValueAtTime(0.0001, time + 2.6);
      const partial = ctx.createOscillator();
      partial.type = 'sine';
      partial.frequency.value = frequency;
      const shimmer = ctx.createOscillator();
      shimmer.type = 'sine';
      shimmer.frequency.value = frequency * 2.76;
      const shimmerGain = ctx.createGain();
      shimmerGain.gain.value = 0.3;
      partial.connect(voice);
      shimmer.connect(shimmerGain);
      shimmerGain.connect(voice);
      voice.connect(this.sfxBus as GainLike);
      partial.start(time);
      shimmer.start(time);
      partial.stop(time + 2.7);
      shimmer.stop(time + 2.7);
    });
  }

  /** Stops the scheduler (used on teardown). The context itself intentionally persists. */
  dispose(): void {
    if (this.timer !== null) {
      this.clearIntervalFn(this.timer);
      this.timer = null;
    }
    this.started = false;
  }
}
