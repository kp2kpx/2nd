/**
 * useAudio — GLADAITORS audio system
 *
 * Handles background music (looping, fade-in) and one-shot SFX.
 * Uses HTML Audio elements for file-based sounds with a Web Audio API
 * synthetic fallback so the system works immediately even without audio files.
 *
 * Respects browser autoplay policy: audio only starts after the first user
 * interaction. Works gracefully inside Farcaster Mini App iframes.
 *
 * ─── AUDIO FILE SOURCES ────────────────────────────────────────────────────
 *
 * Place files in /public/audio/. See /public/audio/README.md for full list.
 *
 * BACKGROUND MUSIC — calm ancient/ambient loop:
 *   File: /public/audio/music.mp3
 *   Source: Pixabay "Ancient Greece" by Coma-Media (CC0)
 *     https://pixabay.com/music/meditationspiritual-ancient-greece-162313/
 *   Alt:   Pixabay "Meditation Ambient" by Lexin_Music (CC0)
 *     https://pixabay.com/music/meditationspiritual-meditation-ambient-112280/
 *
 * HIT SFX — sword clash / metal impact:
 *   File: /public/audio/hit.mp3
 *   Source: Mixkit free SFX — https://mixkit.co/free-sound-effects/sword/
 *   Alt:   Pixabay — https://pixabay.com/sound-effects/search/sword/
 *
 * CRIT SFX — power charge-up (fires at charge moment, before projectile):
 *   File: /public/audio/crit.mp3
 *   Source: Mixkit "Power Up" — https://mixkit.co/free-sound-effects/game/
 *   Alt:   Freesound "charge up" search — https://freesound.org/search/?q=charge+up
 *
 * DEATH SFX — dramatic defeat finale:
 *   File: /public/audio/death.mp3
 *   Source: Mixkit dramatic/fail — https://mixkit.co/free-sound-effects/fail/
 *   Alt:   Pixabay "game over" — https://pixabay.com/sound-effects/search/game-over/
 *
 * VICTORY SFX — triumphant fanfare (player wins):
 *   File: /public/audio/victory.mp3
 *   Source: Mixkit "Win Fanfare" — https://mixkit.co/free-sound-effects/win/
 *   Alt:   Pixabay "victory" — https://pixabay.com/sound-effects/search/victory/
 *
 * ROUND START SFX — subtle bell (optional):
 *   File: /public/audio/round_start.mp3
 *   Source: Mixkit bell — https://mixkit.co/free-sound-effects/bell/
 *
 * ─── VOLUME LEVELS ─────────────────────────────────────────────────────────
 *   Background music: 0.3
 *   SFX: 0.7
 */

"use client";

import { useEffect, useRef, useCallback, useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SfxName = "hit" | "crit" | "death" | "victory" | "round_start";

interface AudioConfig {
  musicSrc?: string;
  sfxSrcs?: Partial<Record<SfxName, string>>;
  /** Set to true to suppress background music entirely (SFX still work). */
  disableMusic?: boolean;
}

interface UseAudioReturn {
  isMuted: boolean;
  toggleMute: () => void;
  playSfx: (name: SfxName) => void;
  /** Call once after the first user interaction to unlock and start music */
  unlockAndPlay: () => void;
  musicReady: boolean;
}

// ─── Default paths ───────────────────────────────────────────────────────────

const DEFAULT_MUSIC_SRC = "/audio/music.mp3";
const DEFAULT_SFX_SRCS: Record<SfxName, string> = {
  hit:         "/audio/hit.mp3",
  crit:        "/audio/crit.mp3",
  death:       "/audio/death.mp3",
  victory:     "/audio/victory.mp3",
  round_start: "/audio/round_start.mp3",
};

const MUSIC_VOLUME = 0.3;
const SFX_VOLUME   = 0.7;
const FADE_DURATION_MS = 2000; // music fade-in duration

// ─── localStorage key ────────────────────────────────────────────────────────

const MUTE_KEY = "gladaitors_audio_muted";

// ─── Synthetic fallback via Web Audio API ────────────────────────────────────
// Generates a simple tone so SFX triggers are audible even without audio files.
// Each SFX gets a distinctive tone shape.

function createAudioContext(): AudioContext | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return null;
    return new Ctx();
  } catch {
    return null;
  }
}

function playSyntheticSfx(ctx: AudioContext, name: SfxName): void {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (name) {
      case "hit": {
        // Short metallic thud: sawtooth, 220Hz → 100Hz drop, 120ms
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.12);
        gain.gain.setValueAtTime(SFX_VOLUME * 0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }
      case "crit": {
        // Rising energy charge: sine, 200Hz → 800Hz, 200ms
        osc.type = "sine";
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
        gain.gain.setValueAtTime(SFX_VOLUME * 0.5, now);
        gain.gain.linearRampToValueAtTime(SFX_VOLUME * 0.8, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }
      case "death": {
        // Low rumble then silence: square, 80Hz → 40Hz, 600ms
        osc.type = "square";
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.6);
        gain.gain.setValueAtTime(SFX_VOLUME * 0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
        break;
      }
      case "victory": {
        // Simple major triad arpeggio: three quick beeps
        const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
        freqs.forEach((freq, i) => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2);
          g2.connect(ctx.destination);
          o2.type = "triangle";
          o2.frequency.value = freq;
          const t = now + i * 0.15;
          g2.gain.setValueAtTime(SFX_VOLUME * 0.5, t);
          g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
          o2.start(t);
          o2.stop(t + 0.25);
        });
        // Silence the primary osc immediately (we used separate ones above)
        gain.gain.setValueAtTime(0, now);
        osc.start(now);
        osc.stop(now + 0.01);
        return;
      }
      case "round_start": {
        // Soft bell: triangle, 660Hz, 300ms
        osc.type = "triangle";
        osc.frequency.setValueAtTime(660, now);
        gain.gain.setValueAtTime(SFX_VOLUME * 0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }
    }
  } catch {
    // Ignore — audio is non-critical
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAudio(config: AudioConfig = {}): UseAudioReturn {
  const musicSrc     = config.musicSrc ?? DEFAULT_MUSIC_SRC;
  const sfxSrcs      = { ...DEFAULT_SFX_SRCS, ...config.sfxSrcs };
  const disableMusic = config.disableMusic ?? false;

  // Read initial mute state from localStorage (SSR-safe)
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(MUTE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [musicReady, setMusicReady] = useState(false);

  // Refs — stable across renders, no re-render on change
  const musicRef       = useRef<HTMLAudioElement | null>(null);
  const sfxRef         = useRef<Partial<Record<SfxName, HTMLAudioElement>>>({});
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const unlockedRef    = useRef(false);
  const isMutedRef     = useRef(isMuted);
  const fadeTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep ref in sync
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // ── Init audio elements ──────────────────────────────────────────────────
  //
  // AUDIO FILES MISSING: Drop MP3s into /public/audio/ to enable file-based
  // playback. Required files:
  //   /public/audio/music.mp3      — background loop
  //   /public/audio/hit.mp3        — sword hit SFX
  //   /public/audio/crit.mp3       — critical hit charge-up SFX
  //   /public/audio/death.mp3      — death SFX
  //   /public/audio/victory.mp3    — victory fanfare SFX
  //   /public/audio/round_start.mp3 — round start bell SFX
  //
  // Until those files exist, the synthetic Web Audio fallback is used for SFX
  // and music is silent. No 404 errors are logged — audio failure is silent.

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Background music element — errors suppressed; file may not exist yet.
    const music = new Audio();
    music.loop   = true;
    music.volume = 0; // starts at 0, fades in after unlock
    music.preload = "none"; // don't auto-request until we know file exists

    // Silence 404 errors from the console — audio files are optional.
    music.addEventListener("error", () => {
      // File not found or format unsupported — synthetic fallback will be used.
      // musicReady stays false.
    }, { once: true });
    music.addEventListener("canplaythrough", () => setMusicReady(true), { once: true });

    // Probe the music file — set src after attaching listeners.
    // If the file doesn't exist, the error handler above silently catches it.
    music.src = musicSrc;
    musicRef.current = music;

    // Pre-load SFX — suppress all 404 errors; synthetic tones serve as fallback.
    (Object.keys(sfxSrcs) as SfxName[]).forEach((name) => {
      const audio = new Audio();
      audio.preload = "none";
      audio.volume  = SFX_VOLUME;
      // Silence 404 / format errors — playSfx() falls back to synthetic on error.
      audio.addEventListener("error", () => {}, { once: true });
      audio.src = sfxSrcs[name]!;
      sfxRef.current[name] = audio;
    });

    return () => {
      // Cleanup on unmount
      if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
      music.pause();
      music.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fade-in helper ───────────────────────────────────────────────────────

  const fadeIn = useCallback((audio: HTMLAudioElement, targetVolume: number) => {
    if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
    const steps    = 40;
    const interval = FADE_DURATION_MS / steps;
    const step     = targetVolume / steps;
    audio.volume   = 0;

    fadeTimerRef.current = setInterval(() => {
      const next = Math.min(audio.volume + step, targetVolume);
      audio.volume = next;
      if (next >= targetVolume) {
        clearInterval(fadeTimerRef.current!);
        fadeTimerRef.current = null;
      }
    }, interval);
  }, []);

  // ── Unlock and start music after first user interaction ─────────────────

  const unlockAndPlay = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;

    // Create AudioContext for SFX synthetic fallback — must happen from user gesture
    if (!audioCtxRef.current) {
      audioCtxRef.current = createAudioContext();
    }

    // Resume context if it was suspended by the browser
    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }

    // Start music unless muted or explicitly disabled for this provider instance
    const music = musicRef.current;
    if (music && !isMutedRef.current && !disableMusic) {
      music.play()
        .then(() => fadeIn(music, MUSIC_VOLUME))
        .catch(() => {
          // Autoplay still blocked in some contexts — fail silently
        });
    }
  }, [fadeIn, disableMusic]);

  // ── Mute toggle ──────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;

      // Persist preference
      try {
        localStorage.setItem(MUTE_KEY, String(next));
      } catch {
        // ignore
      }

      const music = musicRef.current;
      if (music) {
        if (next) {
          // Muting — pause music smoothly
          if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
          music.pause();
        } else {
          // Unmuting — resume music if unlocked and not disabled
          if (unlockedRef.current && !disableMusic) {
            music.play()
              .then(() => fadeIn(music, MUSIC_VOLUME))
              .catch(() => {});
          }
        }
      }

      return next;
    });
  }, [fadeIn, disableMusic]);

  // ── Play SFX ─────────────────────────────────────────────────────────────

  const playSfx = useCallback((name: SfxName) => {
    if (isMutedRef.current) return;
    if (!unlockedRef.current) return; // don't play before first interaction

    const audio = sfxRef.current[name];
    if (audio) {
      // Attempt file-based playback
      // Clone the audio so overlapping hits don't cut each other off
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = SFX_VOLUME;
      clone.play().catch(() => {
        // File failed — fall back to synthetic tone
        if (audioCtxRef.current) {
          playSyntheticSfx(audioCtxRef.current, name);
        }
      });
    } else if (audioCtxRef.current) {
      // No file element at all — pure synthetic
      playSyntheticSfx(audioCtxRef.current, name);
    }
  }, []);

  return { isMuted, toggleMute, playSfx, unlockAndPlay, musicReady };
}

// ─── Context for sharing audio state across the app ──────────────────────────
// Wrap the app in <AudioProvider> once (in layout or providers) so any
// component can call useFightAudio() without prop-drilling.

import { createContext, useContext, type ReactNode } from "react";

interface AudioContextValue extends UseAudioReturn {}

const AudioCtx = createContext<AudioContextValue | null>(null);

export function AudioProvider({
  children,
  config,
}: {
  children: ReactNode;
  config?: AudioConfig;
}) {
  const audio = useAudio(config);

  // Document-level first-interaction listener — catches ANY click or keypress
  // anywhere on the page so music starts as soon as the user does anything,
  // not just when FightReplay mounts. This is the most reliable way to satisfy
  // browser autoplay policy without requiring explicit opt-in.
  //
  // Skipped when disableMusic is true: those providers are scoped to pages that
  // should never start background music (e.g. the Training Ground sandbox).
  // FightReplay still calls unlockAndPlay() directly so SFX still work.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (config?.disableMusic) return; // no doc listener needed; no music to start

    const unlock = () => audio.unlockAndPlay();
    const events = ["click", "touchstart", "keydown"] as const;
    events.forEach((e) => document.addEventListener(e, unlock, { once: true, passive: true }));
    return () => {
      events.forEach((e) => document.removeEventListener(e, unlock));
    };
  }, [audio.unlockAndPlay, config?.disableMusic]);

  return <AudioCtx.Provider value={audio}>{children}</AudioCtx.Provider>;
}

/**
 * Use this in any component to access the shared audio system.
 * Returns null if called outside AudioProvider — fail gracefully.
 */
export function useFightAudio(): AudioContextValue | null {
  return useContext(AudioCtx);
}
