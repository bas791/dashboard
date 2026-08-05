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

  return { soundEnabled, enableSound, playChime };
}
