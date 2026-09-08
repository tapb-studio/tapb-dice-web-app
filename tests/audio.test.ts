import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  isMuted,
  setMuted,
  toggleMute,
  playDiceShakeSound,
  playDiceHitSound,
  playCritHitSound,
  playCritFailSound,
  getAudioContext,
  setAudioContext,
} from "@/lib/audio";

interface MockAudioParam {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
}

function createMockAudioParam(initialValue = 0): MockAudioParam {
  return {
    value: initialValue,
    setValueAtTime: vi.fn().mockReturnThis(),
    linearRampToValueAtTime: vi.fn().mockReturnThis(),
    exponentialRampToValueAtTime: vi.fn().mockReturnThis(),
  };
}

interface MockGainNode {
  gain: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

interface MockOscillatorNode {
  type: OscillatorType;
  frequency: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

interface MockBiquadFilterNode {
  type: BiquadFilterType;
  frequency: MockAudioParam;
  Q: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
}

interface MockBufferSourceNode {
  buffer: any;
  playbackRate: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

function createMockAudioContext(state: "running" | "suspended" = "running") {
  const createdOscillators: MockOscillatorNode[] = [];
  const createdGains: MockGainNode[] = [];
  const createdFilters: MockBiquadFilterNode[] = [];
  const createdBufferSources: MockBufferSourceNode[] = [];

  const mockContext = {
    state,
    currentTime: 0.1,
    sampleRate: 44100,
    destination: { tag: "destination" },
    resume: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn(() => {
      const gainNode: MockGainNode = {
        gain: createMockAudioParam(1),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      createdGains.push(gainNode);
      return gainNode;
    }),
    createOscillator: vi.fn(() => {
      const oscNode: MockOscillatorNode = {
        type: "sine",
        frequency: createMockAudioParam(440),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      createdOscillators.push(oscNode);
      return oscNode;
    }),
    createBiquadFilter: vi.fn(() => {
      const filterNode: MockBiquadFilterNode = {
        type: "lowpass",
        frequency: createMockAudioParam(350),
        Q: createMockAudioParam(1),
        connect: vi.fn(),
      };
      createdFilters.push(filterNode);
      return filterNode;
    }),
    createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => {
      const channelData = new Float32Array(length);
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData: vi.fn(() => channelData),
      };
    }),
    createBufferSource: vi.fn(() => {
      const sourceNode: MockBufferSourceNode = {
        buffer: null,
        playbackRate: createMockAudioParam(1),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      createdBufferSources.push(sourceNode);
      return sourceNode;
    }),
    // Helper accessors for assertions
    _createdOscillators: createdOscillators,
    _createdGains: createdGains,
    _createdFilters: createdFilters,
    _createdBufferSources: createdBufferSources,
  };

  return mockContext;
}

describe("Audio Sound Engine (lib/audio.ts)", () => {
  beforeEach(() => {
    setMuted(false);
    setAudioContext(null);
  });

  afterEach(() => {
    setAudioContext(null);
  });

  describe("Mute State Management", () => {
    it("defaults to unmuted (isMuted === false)", () => {
      expect(isMuted()).toBe(false);
    });

    it("toggles mute state and returns the new value", () => {
      expect(toggleMute()).toBe(true);
      expect(isMuted()).toBe(true);
      expect(toggleMute()).toBe(false);
      expect(isMuted()).toBe(false);
    });

    it("sets mute state explicitly via setMuted", () => {
      setMuted(true);
      expect(isMuted()).toBe(true);
      setMuted(false);
      expect(isMuted()).toBe(false);
    });
  });

  describe("SSR & Headless Node Environment Safety", () => {
    it("does not throw or fail when playing sounds without AudioContext available", () => {
      setAudioContext(null);
      expect(() => playDiceShakeSound()).not.toThrow();
      expect(() => playDiceHitSound()).not.toThrow();
      expect(() => playCritHitSound()).not.toThrow();
      expect(() => playCritFailSound()).not.toThrow();
    });

    it("returns null for getAudioContext in SSR when no window/AudioContext is defined", () => {
      setAudioContext(null);
      expect(getAudioContext()).toBeNull();
    });
  });

  describe("Muted State Guarding", () => {
    it("does not invoke any audio nodes or resume when muted", () => {
      const mockCtx = createMockAudioContext();
      setAudioContext(mockCtx as unknown as AudioContext);
      setMuted(true);

      playDiceShakeSound();
      playDiceHitSound();
      playCritHitSound();
      playCritFailSound();

      expect(mockCtx.createGain).not.toHaveBeenCalled();
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
      expect(mockCtx.createBufferSource).not.toHaveBeenCalled();
      expect(mockCtx.resume).not.toHaveBeenCalled();
    });
  });

  describe("AudioContext Resume on Interaction", () => {
    it("calls resume if audio context state is suspended", () => {
      const mockCtx = createMockAudioContext("suspended");
      setAudioContext(mockCtx as unknown as AudioContext);

      playDiceShakeSound();
      expect(mockCtx.resume).toHaveBeenCalledTimes(1);
    });
  });

  describe("playDiceShakeSound", () => {
    it("generates noise buffer with bandpass/lowpass filtering for dice rattling", () => {
      const mockCtx = createMockAudioContext();
      setAudioContext(mockCtx as unknown as AudioContext);

      playDiceShakeSound();

      expect(mockCtx.createBuffer).toHaveBeenCalled();
      expect(mockCtx.createBufferSource).toHaveBeenCalled();
      expect(mockCtx.createBiquadFilter).toHaveBeenCalled();
      expect(mockCtx.createGain).toHaveBeenCalled();

      const source = mockCtx._createdBufferSources[0];
      expect(source.start).toHaveBeenCalled();
      expect(source.connect).toHaveBeenCalled();

      const gain = mockCtx._createdGains[0];
      expect(gain.connect).toHaveBeenCalled();
    });
  });

  describe("playDiceHitSound", () => {
    it("generates clattering table impact using procedural noise and decay envelope", () => {
      const mockCtx = createMockAudioContext();
      setAudioContext(mockCtx as unknown as AudioContext);

      playDiceHitSound();

      expect(mockCtx.createBuffer).toHaveBeenCalled();
      expect(mockCtx.createBufferSource).toHaveBeenCalled();
      expect(mockCtx.createGain).toHaveBeenCalled();

      const source = mockCtx._createdBufferSources[0];
      expect(source.start).toHaveBeenCalled();

      // Verify gain decay envelope is configured
      const gain = mockCtx._createdGains[0];
      expect(gain.gain.setValueAtTime).toHaveBeenCalled();
    });
  });

  describe("playCritHitSound (Nat 20 Fanfare)", () => {
    it("generates an ascending triumph fanfare chime using procedural oscillators", () => {
      const mockCtx = createMockAudioContext();
      setAudioContext(mockCtx as unknown as AudioContext);

      playCritHitSound();

      // Expect triumphant arpeggio/fanfare chords (at least 3 ascending harmonic notes)
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockCtx._createdOscillators.length).toBeGreaterThanOrEqual(3);

      mockCtx._createdOscillators.forEach((osc) => {
        expect(osc.start).toHaveBeenCalled();
        expect(osc.stop).toHaveBeenCalled();
        expect(osc.frequency.setValueAtTime).toHaveBeenCalled();
      });

      // Verify oscillator frequencies form an ascending triumphant sequence
      const freqs = mockCtx._createdOscillators.map((osc) => {
        const calls = osc.frequency.setValueAtTime.mock.calls;
        return calls[0]?.[0];
      });
      for (let i = 1; i < freqs.length; i++) {
        expect(freqs[i]).toBeGreaterThan(freqs[i - 1]);
      }
    });
  });

  describe("playCritFailSound (Nat 1 Thud)", () => {
    it("generates a low impact descending pitch/thud using procedural oscillators", () => {
      const mockCtx = createMockAudioContext();
      setAudioContext(mockCtx as unknown as AudioContext);

      playCritFailSound();

      expect(mockCtx.createOscillator).toHaveBeenCalled();
      const osc = mockCtx._createdOscillators[0];
      expect(osc.start).toHaveBeenCalled();
      expect(osc.stop).toHaveBeenCalled();

      // Should be low frequency with descending pitch modulation or low impact
      const setCall = osc.frequency.setValueAtTime.mock.calls[0];
      expect(setCall[0]).toBeLessThanOrEqual(250); // low pitch base
    });
  });

  describe("Browser Environment AudioContext Auto-Initialization", () => {
    it("instantiates AudioContext if window.AudioContext is present", () => {
      const mockConstructor = vi.fn(function () {
        return createMockAudioContext();
      });
      (globalThis as any).window = {
        AudioContext: mockConstructor,
      };

      setAudioContext(null);
      const ctx = getAudioContext();
      expect(mockConstructor).toHaveBeenCalled();
      expect(ctx).not.toBeNull();

      delete (globalThis as any).window;
    });

    it("falls back to window.webkitAudioContext if AudioContext is not present", () => {
      const mockWebkitConstructor = vi.fn(function () {
        return createMockAudioContext();
      });
      (globalThis as any).window = {
        webkitAudioContext: mockWebkitConstructor,
      };

      setAudioContext(null);
      const ctx = getAudioContext();
      expect(mockWebkitConstructor).toHaveBeenCalled();
      expect(ctx).not.toBeNull();

      delete (globalThis as any).window;
    });
  });
});
