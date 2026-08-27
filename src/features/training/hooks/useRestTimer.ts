import { useEffect, useState } from "react";

interface UseRestTimerOptions {
  restTargetEndTime: number | null;
  stopRestTimer: () => void;
}

interface UseRestTimerResult {
  localRestSecondsLeft: number | null;
  isTimerRunning: boolean;
}

/**
 * Manages the client-side countdown for a rest timer.
 *
 * The source of truth for "when does the rest end" lives in Zustand as a
 * timestamp (`restTargetEndTime`). This hook derives a local `secondsLeft`
 * value from that timestamp via a 1-second interval, so it survives app
 * backgrounding and re-opening.
 *
 * When the timer reaches zero it fires:
 * - Vibration (Android)
 * - An AudioContext double-beep (iOS + Android)
 * - Calls `stopRestTimer()` on the store
 */
export function useRestTimer({
  restTargetEndTime,
  stopRestTimer,
}: UseRestTimerOptions): UseRestTimerResult {
  const [localRestSecondsLeft, setLocalRestSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (restTargetEndTime === null) {
      queueMicrotask(() => setLocalRestSecondsLeft(null));
      return;
    }

    const calculateRemaining = () =>
      Math.max(0, Math.floor((restTargetEndTime - Date.now()) / 1000));

    const fireAlert = () => {
      // Vibration — Android only
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
      // Audio double-beep — cross-platform (iOS + Android)
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const beep = (start: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.4, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
            osc.start(start);
            osc.stop(start + 0.25);
          };
          beep(ctx.currentTime);
          beep(ctx.currentTime + 0.35);
        }
      } catch {
        // Audio not available — silently ignore
      }
    };

    const initialRemaining = calculateRemaining();
    if (initialRemaining <= 0) {
      fireAlert();
      stopRestTimer();
      queueMicrotask(() => setLocalRestSecondsLeft(null));
      return;
    }

    queueMicrotask(() => setLocalRestSecondsLeft(initialRemaining));

    const intervalId = setInterval(() => {
      const remaining = calculateRemaining();
      if (remaining <= 0) {
        clearInterval(intervalId);
        fireAlert();
        stopRestTimer();
        setLocalRestSecondsLeft(null);
      } else {
        setLocalRestSecondsLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [restTargetEndTime, stopRestTimer]);

  return {
    localRestSecondsLeft,
    isTimerRunning: localRestSecondsLeft !== null,
  };
}
