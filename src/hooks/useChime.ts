"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Bell/chime for new-enquiry alerts, synthesised with the Web Audio API so no
 * audio asset is needed. Browsers block audio until the page has been
 * interacted with, so the dashboard shows an "enable sound" prompt; once
 * clicked (a single click anywhere), the AudioContext unlocks and every
 * subsequent enquiry chimes automatically.
 */
export function useChime(): {
  soundEnabled: boolean;
  enableSound: () => void;
  playChime: () => void;
  playSiren: () => void;
} {
  const contextRef = useRef<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const enableSound = useCallback(() => {
    if (contextRef.current) {
      setSoundEnabled(true);
      return;
    }
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      contextRef.current = new Ctx();
      void contextRef.current.resume();
      setSoundEnabled(true);
    } catch {
      // Audio unavailable — dashboard still works, just silently.
    }
  }, []);

  // Any first interaction unlocks audio (handy for TV remotes / kiosk setups).
  useEffect(() => {
    const unlock = () => enableSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [enableSound]);

  const playChime = useCallback(() => {
    const ctx = contextRef.current;
    if (!ctx || ctx.state !== "running") return;

    // Two-strike bell: a bright strike plus a softer echo a moment later.
    const strike = (startAt: number, freq: number, peak: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      // A quiet detuned partial gives the tone a metallic bell character.
      const partial = ctx.createOscillator();
      const partialGain = ctx.createGain();
      partial.type = "sine";
      partial.frequency.value = freq * 2.76;
      partialGain.gain.value = 0.2;

      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(peak, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.4);

      osc.connect(gain);
      partial.connect(partialGain);
      partialGain.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startAt);
      partial.start(startAt);
      osc.stop(startAt + 1.5);
      partial.stop(startAt + 1.5);
    };

    const now = ctx.currentTime;
    strike(now, 880, 0.4);
    strike(now + 0.18, 1174.66, 0.25);
  }, []);

  /**
   * Two-tone alarm for SLA breaches — a lead has sat uncalled past the red
   * threshold. Deliberately harsher than the bell so it cuts through office
   * noise, but band-limited so it doesn't distort on TV speakers.
   */
  const playSiren = useCallback(() => {
    const ctx = contextRef.current;
    if (!ctx || ctx.state !== "running") return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "square";
    filter.type = "lowpass";
    filter.frequency.value = 2200;

    // Hi–lo alternation every 300ms, like a classic two-tone alarm.
    const HI = 932.33; // B♭5
    const LO = 622.25; // E♭5
    const STEPS = 8;
    for (let i = 0; i < STEPS; i++) {
      osc.frequency.setValueAtTime(i % 2 === 0 ? HI : LO, now + i * 0.3);
    }
    const total = STEPS * 0.3;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.04);
    gain.gain.setValueAtTime(0.28, now + total - 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + total);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + total);
  }, []);

  return { soundEnabled, enableSound, playChime, playSiren };
}
