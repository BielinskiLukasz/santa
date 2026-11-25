import { describe, expect, it, vi } from 'vitest';
import { SoundEngine } from '../../../src/audio/engine';
import type {
  AudioBufferLike,
  AudioContextLike,
  AudioParamLike,
  BufferSourceLike,
  ConvolverLike,
  FilterLike,
  GainLike,
  OscillatorLike,
} from '../../../src/audio/engine';

class FakeParam implements AudioParamLike {
  value = 0;
  readonly calls: [string, number][] = [];
  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.calls.push(['set', time]);
  }
  linearRampToValueAtTime(value: number, time: number): void {
    this.calls.push(['linear', time]);
    this.value = value;
  }
  exponentialRampToValueAtTime(value: number, time: number): void {
    this.calls.push(['exp', time]);
    this.value = value;
  }
  setTargetAtTime(value: number, time: number): void {
    this.calls.push(['target', time]);
    this.value = value;
  }
}

class FakeGain implements GainLike {
  gain = new FakeParam();
  connect(): void {}
}

class FakeOscillator implements OscillatorLike {
  type = 'sine';
  frequency = new FakeParam();
  started = false;
  connect(): void {}
  start(): void {
    this.started = true;
  }
  stop(): void {}
}

class FakeSource implements BufferSourceLike {
  buffer: unknown = null;
  loop = false;
  playbackRate = new FakeParam();
  connect(): void {}
  start(): void {}
  stop(): void {}
}

class FakeFilter implements FilterLike {
  type = 'lowpass';
  frequency = new FakeParam();
  Q = new FakeParam();
  connect(): void {}
}

class FakeConvolver implements ConvolverLike {
  buffer: unknown = null;
  connect(): void {}
}

class FakeContext implements AudioContextLike {
  currentTime = 0;
  state = 'running';
  sampleRate = 44_100;
  destination = {};
  readonly gains: FakeGain[] = [];
  readonly oscillators: FakeOscillator[] = [];
  readonly sources: FakeSource[] = [];
  readonly resume = vi.fn(async () => {
    this.state = 'running';
  });
  readonly suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createOscillator(): FakeOscillator {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }
  createBufferSource(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  createBiquadFilter(): FakeFilter {
    return new FakeFilter();
  }
  createConvolver(): FakeConvolver {
    return new FakeConvolver();
  }
  createBuffer(_channels: number, length: number): AudioBufferLike {
    return { getChannelData: () => new Float32Array(length) };
  }
}

function makeEngine(ctx: FakeContext, muted = false) {
  let tickHandler: (() => void) | null = null;
  const engine = new SoundEngine({
    createContext: () => ctx,
    muted,
    random: () => 0.5,
    setInterval: (handler) => {
      tickHandler = handler;
      return 1;
    },
    clearInterval: () => {},
  });
  return {
    engine,
    tick: (advanceS = 0.4) => {
      ctx.currentTime += advanceS;
      tickHandler?.();
    },
  };
}

describe('Silnik dźwięku', () => {
  it('nie tworzy kontekstu przed pierwszym gestem i tworzy tylko jeden', async () => {
    const ctx = new FakeContext();
    let created = 0;
    const engine = new SoundEngine({
      createContext: () => {
        created += 1;
        return ctx;
      },
      random: () => 0.5,
      setInterval: () => 1,
      clearInterval: () => {},
    });
    engine.envelopeRustle();
    engine.sealPlop();
    expect(created).toBe(0);
    expect(engine.isStarted).toBe(false);
    await engine.unlock();
    await engine.unlock();
    expect(created).toBe(1);
    expect(engine.isStarted).toBe(true);
  });

  it('gra pozytywkę skalą pentatoniczną po starcie', async () => {
    const ctx = new FakeContext();
    const { engine, tick } = makeEngine(ctx);
    await engine.unlock();
    tick();
    tick();
    tick();
    const frequencies = ctx.oscillators.map((osc) => osc.frequency.value);
    expect(frequencies.length).toBeGreaterThan(0);
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
    expect(frequencies.some((frequency) => scale.includes(frequency))).toBe(true);
    // The fire bed loop is running from the start.
    expect(ctx.sources.some((source) => source.loop)).toBe(true);
  });

  it('wyciszenie zeruje wzmocnienie główne, także przy starcie z zapisanego stanu', async () => {
    const ctx = new FakeContext();
    const { engine } = makeEngine(ctx, true);
    await engine.unlock();
    const master = ctx.gains[0] as FakeGain;
    expect(master.gain.value).toBe(0);
    engine.setMuted(false);
    expect(master.gain.calls.some(([kind]) => kind === 'target')).toBe(true);
    expect(engine.isMuted).toBe(false);
    engine.setMuted(true);
    expect(engine.isMuted).toBe(true);
    expect(master.gain.value).toBe(0);
  });

  it('wstrzymuje kontekst przy ukrytej karcie i wznowia po powrocie', async () => {
    const ctx = new FakeContext();
    const { engine } = makeEngine(ctx);
    await engine.setDocumentHidden(true);
    expect(ctx.suspend).not.toHaveBeenCalled();
    await engine.unlock();
    await engine.setDocumentHidden(true);
    expect(ctx.suspend).toHaveBeenCalledTimes(1);
    await engine.setDocumentHidden(false);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('efekty budują oczekiwane źródła dźwięku i są bezpieczne przed startem', async () => {
    const ctx = new FakeContext();
    const { engine } = makeEngine(ctx);
    await engine.unlock();
    const sourcesBefore = ctx.sources.length;
    engine.envelopeRustle();
    expect(ctx.sources.length).toBe(sourcesBefore + 1);
    const oscsBefore = ctx.oscillators.length;
    engine.sealPlop();
    expect(ctx.oscillators.length).toBe(oscsBefore + 1);
    engine.celebrationBell();
    expect(ctx.oscillators.length).toBe(oscsBefore + 1 + 6);
  });

  it('brak WebAudio oznacza bezpieczny brak dźwięku', async () => {
    const engine = new SoundEngine({ createContext: () => null });
    await expect(engine.unlock()).resolves.toBeUndefined();
    expect(engine.isStarted).toBe(false);
    engine.envelopeRustle();
    engine.celebrationBell();
  });
});
