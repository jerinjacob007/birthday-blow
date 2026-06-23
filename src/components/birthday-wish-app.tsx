"use client";

import confetti from "canvas-confetti";
import { Gift, Mic, MicOff, RefreshCw, Sparkles, Wind } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { GiftCrateDrop, type GiftCrateLandingTarget } from "@/components/gift-crate-drop";
import { createBlowDetector, type BlowDetector, type BlowStatus } from "@/lib/blow-detector";
import { getBlowMeterValue } from "@/lib/blow-meter";
import { getCandleFlameFrame, getCandleFumeMotion, getCandleFumePuffs, getCandleFlameOffset, CANDLE_COUNT } from "@/lib/candle-flame";
import {
  GIFT_CRATE_SEQUENCE,
  type GiftCratePhase,
} from "@/lib/gift-crate-sequence";

type MicStatus = BlowStatus | "idle" | "requesting" | "denied" | "unsupported" | "error";

type AudioContextFactory = new (contextOptions?: AudioContextOptions) => AudioContext;
type FumePuffStyle = CSSProperties & {
  "--fume-delay": string;
  "--fume-left": string;
  "--fume-size": string;
};
type SmokeStyle = CSSProperties & {
  "--fume-duration": string;
  "--fume-rise": string;
  "--fume-scale-end": number;
};

const STATUS_COPY: Record<MicStatus, string> = {
  idle: "Make a wish",
  requesting: "Opening the celebration",
  calibrating: "Listening to the room",
  listening: "Blow toward the candle",
  blowing: "Keep blowing",
  success: "The candle is out",
  denied: "Microphone blocked",
  unsupported: "Microphone unavailable",
  error: "Microphone interrupted",
};

function getAudioVolume(data: Uint8Array) {
  let total = 0;
  let peak = 0;

  for (const value of data) {
    const centered = (value - 128) / 128;
    total += centered * centered;
    peak = Math.max(peak, Math.abs(centered));
  }

  return {
    rms: Math.sqrt(total / data.length),
    peak,
  };
}

function fireConfetti() {
  if (typeof window === "undefined") {
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const baseOptions = {
    disableForReducedMotion: true,
    gravity: reduceMotion ? 0.85 : 0.72,
    ticks: reduceMotion ? 90 : 180,
    scalar: reduceMotion ? 0.78 : 1,
    colors: ["#F97316", "#F9A8D4", "#2563EB", "#BE123C", "#FDE68A", "#22C55E"],
  };

  confetti({
    ...baseOptions,
    particleCount: reduceMotion ? 36 : 120,
    spread: 78,
    origin: { x: 0.5, y: 0.46 },
  });

  if (!reduceMotion) {
    window.setTimeout(() => {
      confetti({
        ...baseOptions,
        particleCount: 64,
        angle: 62,
        spread: 60,
        origin: { x: 0.08, y: 0.68 },
      });
      confetti({
        ...baseOptions,
        particleCount: 64,
        angle: 118,
        spread: 60,
        origin: { x: 0.92, y: 0.68 },
      });
    }, 180);
  }
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - ((-2 * value + 2) ** 3) / 2;
}

function vibrateForImpact() {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  navigator.vibrate([45, 35, 45]);
}

function StatusIcon({ status }: { status: MicStatus }) {
  if (status === "denied" || status === "unsupported" || status === "error") {
    return <MicOff aria-hidden="true" size={20} strokeWidth={2.3} />;
  }

  if (status === "success") {
    return <Sparkles aria-hidden="true" size={20} strokeWidth={2.3} />;
  }

  if (status === "blowing") {
    return <Wind aria-hidden="true" size={20} strokeWidth={2.3} />;
  }

  return <Mic aria-hidden="true" size={20} strokeWidth={2.3} />;
}

// Candle wick x-positions as % of viewBox width (320px) for absolute flame/smoke overlays
const CANDLE_POSITIONS_PCT: readonly number[] = [31.875, 40.625, 50, 59.375, 68.125];

function CakeIllustration({
  lit,
  extinguished,
  blowLevel,
  flameTimeMs,
}: {
  lit: boolean;
  extinguished: boolean;
  blowLevel: number;
  flameTimeMs: number;
}) {
  const fumePuffs = getCandleFumePuffs();
  const fumeMotion = getCandleFumeMotion();
  const smokeStyle: SmokeStyle = {
    "--fume-duration": `${fumeMotion.durationMs}ms`,
    "--fume-rise": fumeMotion.riseCqw,
    "--fume-scale-end": fumeMotion.endScale,
  };

  // Compute flame frame for each candle; average the glow for the ambient light
  const candleFrames = Array.from({ length: CANDLE_COUNT }, (_, i) =>
    getCandleFlameFrame({
      lit,
      extinguished,
      timestampMs: flameTimeMs + getCandleFlameOffset(i),
      blowLevel,
    })
  );
  const avgGlow = candleFrames.reduce((sum, f) => sum + f.glowOpacity, 0) / CANDLE_COUNT;
  const glowStyle: CSSProperties = { opacity: avgGlow };

  // Staggered smoke delays per candle (ms) so candles appear to go out one-by-one
  const CANDLE_SMOKE_DELAY = [0, 80, 160, 40, 120] as const;

  const ariaLabel = extinguished
    ? "Birthday cake with extinguished candles"
    : lit
      ? "Birthday cake with lit candles"
      : "Birthday cake with unlit candles";

  return (
    <div className="cake-illustration" role="img" aria-label={ariaLabel}>
      <div className="reference-glow" style={glowStyle} aria-hidden="true" />

      <svg className="cake-svg" viewBox="0 0 320 280" aria-hidden="true">
        <defs>
          <linearGradient id="chocGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6B3E26" />
            <stop offset="100%" stopColor="#3B1F0F" />
          </linearGradient>
          <linearGradient id="creamGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF8E7" />
            <stop offset="100%" stopColor="#F5DEB3" />
          </linearGradient>
          <linearGradient id="ganacheGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4A2512" />
            <stop offset="100%" stopColor="#2C1408" />
          </linearGradient>
          <linearGradient id="topCreamGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#FFF0D8" />
          </linearGradient>
          <radialGradient id="plateGrad" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#D4C5A9" />
            <stop offset="100%" stopColor="#8B7355" />
          </radialGradient>
        </defs>

        {/* Table shadow */}
        <ellipse cx="160" cy="264" rx="138" ry="13" fill="rgba(0,0,0,0.28)" />

        {/* Plate */}
        <ellipse cx="160" cy="248" rx="140" ry="12" fill="url(#plateGrad)" />
        <ellipse cx="160" cy="245" rx="136" ry="9" fill="#C8B89A" opacity="0.4" />

        {/* === BOTTOM TIER === */}
        <rect x="18" y="176" width="284" height="72" rx="10" fill="url(#chocGrad)" />
        <rect x="18" y="176" width="284" height="4" rx="2" fill="#D4A24C" opacity="0.5" />
        {/* Ganache drips */}
        <path d="M28 176 Q34 194 30 208" stroke="url(#ganacheGrad)" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M55 176 Q58 188 56 200" stroke="url(#ganacheGrad)" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M82 176 Q88 196 84 212" stroke="url(#ganacheGrad)" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M110 176 Q114 190 112 203" stroke="url(#ganacheGrad)" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M138 176 Q143 198 140 214" stroke="url(#ganacheGrad)" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M165 176 Q168 187 167 198" stroke="url(#ganacheGrad)" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M192 176 Q198 195 194 210" stroke="url(#ganacheGrad)" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M219 176 Q222 190 221 202" stroke="url(#ganacheGrad)" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M246 176 Q252 196 248 211" stroke="url(#ganacheGrad)" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M274 176 Q278 192 276 206" stroke="url(#ganacheGrad)" strokeWidth="9" fill="none" strokeLinecap="round" />
        {/* Sprinkles */}
        <rect x="40"  y="194" width="10" height="3" rx="1.5" fill="#FF6F91" transform="rotate(20 45 195)" />
        <rect x="68"  y="210" width="10" height="3" rx="1.5" fill="#FFD166" transform="rotate(-15 73 211)" />
        <rect x="95"  y="196" width="10" height="3" rx="1.5" fill="#8DD9C4" transform="rotate(35 100 197)" />
        <rect x="122" y="214" width="10" height="3" rx="1.5" fill="#FF7A3D" transform="rotate(-25 127 215)" />
        <rect x="150" y="198" width="10" height="3" rx="1.5" fill="#A78BFA" transform="rotate(10 155 199)" />
        <rect x="178" y="220" width="10" height="3" rx="1.5" fill="#FF6F91" transform="rotate(40 183 221)" />
        <rect x="205" y="200" width="10" height="3" rx="1.5" fill="#FFD166" transform="rotate(-30 210 201)" />
        <rect x="232" y="215" width="10" height="3" rx="1.5" fill="#8DD9C4" transform="rotate(15 237 216)" />
        <rect x="258" y="197" width="10" height="3" rx="1.5" fill="#FF7A3D" transform="rotate(-10 263 198)" />
        {/* Pearl accents */}
        <circle cx="52"  cy="226" r="4" fill="#F0E6D3" />
        <circle cx="108" cy="230" r="3.5" fill="#F0E6D3" />
        <circle cx="160" cy="227" r="4" fill="#F0E6D3" />
        <circle cx="212" cy="229" r="3.5" fill="#F0E6D3" />
        <circle cx="268" cy="225" r="4" fill="#F0E6D3" />

        {/* === MIDDLE TIER === */}
        <rect x="56" y="108" width="208" height="68" rx="10" fill="url(#creamGrad)" />
        <rect x="56" y="108" width="208" height="4" rx="2" fill="#D4A24C" opacity="0.45" />
        {/* Ganache drips */}
        <path d="M66 108 Q71 122 68 134" stroke="url(#ganacheGrad)" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M92 108 Q97 120 94 130" stroke="url(#ganacheGrad)" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M118 108 Q124 124 120 138" stroke="url(#ganacheGrad)" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M145 108 Q149 118 147 128" stroke="url(#ganacheGrad)" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M172 108 Q178 124 174 137" stroke="url(#ganacheGrad)" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M199 108 Q203 120 201 131" stroke="url(#ganacheGrad)" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M226 108 Q232 122 228 135" stroke="url(#ganacheGrad)" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M252 108 Q256 119 254 130" stroke="url(#ganacheGrad)" strokeWidth="8" fill="none" strokeLinecap="round" />
        {/* Sprinkles */}
        <rect x="72"  y="124" width="9" height="3" rx="1.5" fill="#FF6F91" transform="rotate(20 76 125)" />
        <rect x="100" y="138" width="9" height="3" rx="1.5" fill="#FFD166" transform="rotate(-15 104 139)" />
        <rect x="128" y="122" width="9" height="3" rx="1.5" fill="#8DD9C4" transform="rotate(35 132 123)" />
        <rect x="155" y="140" width="9" height="3" rx="1.5" fill="#FF7A3D" transform="rotate(-25 159 141)" />
        <rect x="182" y="125" width="9" height="3" rx="1.5" fill="#A78BFA" transform="rotate(10 186 126)" />
        <rect x="210" y="141" width="9" height="3" rx="1.5" fill="#FF6F91" transform="rotate(40 214 142)" />
        <rect x="236" y="124" width="9" height="3" rx="1.5" fill="#FFD166" transform="rotate(-30 240 125)" />
        {/* Rosettes */}
        <circle cx="80"  cy="154" r="7" fill="#FFC0CB" />
        <circle cx="80"  cy="154" r="4" fill="#FF8FAB" opacity="0.7" />
        <circle cx="130" cy="158" r="7" fill="#FFC0CB" />
        <circle cx="130" cy="158" r="4" fill="#FF8FAB" opacity="0.7" />
        <circle cx="180" cy="155" r="7" fill="#FFC0CB" />
        <circle cx="180" cy="155" r="4" fill="#FF8FAB" opacity="0.7" />
        <circle cx="230" cy="158" r="7" fill="#FFC0CB" />
        <circle cx="230" cy="158" r="4" fill="#FF8FAB" opacity="0.7" />

        {/* === TOP TIER === */}
        <rect x="96" y="48" width="128" height="60" rx="9" fill="url(#topCreamGrad)" />
        <rect x="96" y="48" width="128" height="4" rx="2" fill="#D4A24C" opacity="0.4" />
        {/* Ganache drips */}
        <path d="M104 48 Q109 60 106 70" stroke="url(#ganacheGrad)" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M128 48 Q133 58 130 68" stroke="url(#ganacheGrad)" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M153 48 Q158 62 155 74" stroke="url(#ganacheGrad)" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M178 48 Q182 60 180 70" stroke="url(#ganacheGrad)" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M204 48 Q209 59 206 69" stroke="url(#ganacheGrad)" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M218 48 Q222 60 220 71" stroke="url(#ganacheGrad)" strokeWidth="7" fill="none" strokeLinecap="round" />
        {/* Rosettes */}
        <circle cx="104" cy="96" r="6" fill="#FFC0CB" />
        <circle cx="104" cy="96" r="3.5" fill="#FF8FAB" opacity="0.7" />
        <circle cx="142" cy="99" r="6" fill="#FFC0CB" />
        <circle cx="142" cy="99" r="3.5" fill="#FF8FAB" opacity="0.7" />
        <circle cx="180" cy="97" r="6" fill="#FFC0CB" />
        <circle cx="180" cy="97" r="3.5" fill="#FF8FAB" opacity="0.7" />
        <circle cx="218" cy="99" r="6" fill="#FFC0CB" />
        <circle cx="218" cy="99" r="3.5" fill="#FF8FAB" opacity="0.7" />
        {/* Pearl border */}
        <circle cx="110" cy="106" r="3" fill="#F0E6D3" />
        <circle cx="135" cy="107" r="3" fill="#F0E6D3" />
        <circle cx="160" cy="106" r="3" fill="#F0E6D3" />
        <circle cx="185" cy="107" r="3" fill="#F0E6D3" />
        <circle cx="210" cy="106" r="3" fill="#F0E6D3" />

        {/* === 5 CANDLES on top tier === */}
        {/* Candle 0 — x=102 */}
        <rect x="97.5"  y="14" width="9" height="34" rx="3" fill="#FBE8C6" />
        <rect x="97.5"  y="19" width="9" height="4" fill="#FF6F91" />
        <rect x="97.5"  y="28" width="9" height="4" fill="#FF6F91" />
        <rect x="101"   y="9"  width="3" height="7" rx="1.2" fill="#2B1810" />
        {/* Candle 1 — x=130 */}
        <rect x="125.5" y="10" width="9" height="38" rx="3" fill="#D4F1F4" />
        <rect x="125.5" y="15" width="9" height="4" fill="#A78BFA" />
        <rect x="125.5" y="25" width="9" height="4" fill="#A78BFA" />
        <rect x="129"   y="5"  width="3" height="7" rx="1.2" fill="#2B1810" />
        {/* Candle 2 — x=160 (centre) */}
        <rect x="155.5" y="8"  width="9" height="40" rx="3" fill="#FBE8C6" />
        <rect x="155.5" y="13" width="9" height="4" fill="#FF6F91" />
        <rect x="155.5" y="23" width="9" height="4" fill="#FF6F91" />
        <rect x="159"   y="3"  width="3" height="7" rx="1.2" fill="#2B1810" />
        {/* Candle 3 — x=190 */}
        <rect x="185.5" y="10" width="9" height="38" rx="3" fill="#D4F1F4" />
        <rect x="185.5" y="15" width="9" height="4" fill="#FFD166" />
        <rect x="185.5" y="25" width="9" height="4" fill="#FFD166" />
        <rect x="189"   y="5"  width="3" height="7" rx="1.2" fill="#2B1810" />
        {/* Candle 4 — x=218 */}
        <rect x="213.5" y="12" width="9" height="36" rx="3" fill="#FBE8C6" />
        <rect x="213.5" y="17" width="9" height="4" fill="#FF6F91" />
        <rect x="213.5" y="27" width="9" height="4" fill="#FF6F91" />
        <rect x="217"   y="7"  width="3" height="7" rx="1.2" fill="#2B1810" />
      </svg>

      {/* Per-candle flame + smoke overlays */}
      {CANDLE_POSITIONS_PCT.map((leftPct, i) => {
        const frame = candleFrames[i];
        // Approximate wick-top vertical position as % of 280px viewBox height per candle
        const topPct = [5.4, 2.5, 1.4, 2.5, 3.6][i];
        const overlayStyle: CSSProperties = {
          position: "absolute",
          left: `${leftPct}%`,
          top: `${topPct}%`,
        };
        const puffBaseDelay = CANDLE_SMOKE_DELAY[i];

        return (
          <div key={i} className="candle-overlay" style={overlayStyle} aria-hidden="true">
            {/* Flame */}
            <div className="reference-flame" style={frame.flame} />
            {/* Smoke — only when extinguished */}
            {extinguished ? (
              <div className="reference-smoke active" style={smokeStyle}>
                {fumePuffs.map((puff) => {
                  const puffStyle: FumePuffStyle = {
                    "--fume-delay": `${puff.delayMs + puffBaseDelay}ms`,
                    "--fume-left": puff.leftCqw,
                    "--fume-size": puff.sizeCqw,
                  };
                  return (
                    <span
                      key={`${i}-${puff.leftPx}-${puff.delayMs}`}
                      style={puffStyle}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function BirthdayWishApp() {
  const [entered, setEntered] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [extinguished, setExtinguished] = useState(false);
  const [giftRevealActive, setGiftRevealActive] = useState(false);
  const [cratePhase, setCratePhase] = useState<GiftCratePhase>("idle");
  const [crateLandingTarget, setCrateLandingTarget] = useState<GiftCrateLandingTarget | null>(null);
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [meter, setMeter] = useState(0);
  const [permissionMessage, setPermissionMessage] = useState("");
  const [flameTimeMs, setFlameTimeMs] = useState(0);
  const [manualBlowing, setManualBlowing] = useState(false);

  const detectorRef = useRef<BlowDetector>(createBlowDetector());
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const flameRafRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const crateTimersRef = useRef<number[]>([]);
  const giftRevealRef = useRef<HTMLElement | null>(null);
  const giftRevealStageRef = useRef<HTMLDivElement | null>(null);
  const whooshAudioRef = useRef<HTMLAudioElement | null>(null);
  const impactAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const loveBgmRef = useRef<HTMLAudioElement | null>(null);
  const manualFallbackStatusRef = useRef<MicStatus>("unsupported");
  const completedRef = useRef(false);
  const sequenceTimerRef = useRef<number | null>(null);

  const clearCrateTimers = useCallback(() => {
    for (const timer of crateTimersRef.current) {
      window.clearTimeout(timer);
    }

    crateTimersRef.current = [];

    if (sequenceTimerRef.current !== null) {
      window.clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    }
  }, []);

  const playSound = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio) {
      return;
    }

    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, []);

  const scrollToReveal = useCallback((durationMs: number) => {
    if (!giftRevealRef.current) {
      return;
    }

    if (scrollRafRef.current !== null) {
      window.cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }

    const startY = window.scrollY;
    const targetY = giftRevealRef.current.getBoundingClientRect().top + window.scrollY;
    const distance = targetY - startY;

    if (durationMs <= 0 || prefersReducedMotion()) {
      window.scrollTo({ top: targetY });
      return;
    }

    const startTime = performance.now();

    const tick = (timestampMs: number) => {
      const progress = Math.min(1, (timestampMs - startTime) / durationMs);
      window.scrollTo({ top: startY + distance * easeInOutCubic(progress) });

      if (progress < 1) {
        scrollRafRef.current = window.requestAnimationFrame(tick);
      } else {
        scrollRafRef.current = null;
      }
    };

    scrollRafRef.current = window.requestAnimationFrame(tick);
  }, []);

  const getCrateLandingTarget = useCallback((): GiftCrateLandingTarget | null => {
    if (!giftRevealRef.current || !giftRevealStageRef.current) {
      return null;
    }

    const sectionRect = giftRevealRef.current.getBoundingClientRect();
    const stageRect = giftRevealStageRef.current.getBoundingClientRect();

    return {
      x: stageRect.left + stageRect.width / 2,
      y: stageRect.top - sectionRect.top + stageRect.height / 2,
    };
  }, []);

  const resetCrateSequence = useCallback(() => {
    clearCrateTimers();

    if (scrollRafRef.current !== null) {
      window.cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }

    setGiftRevealActive(false);
    setCratePhase("idle");
    setCrateLandingTarget(null);

    if (loveBgmRef.current) {
      loveBgmRef.current.pause();
      loveBgmRef.current.currentTime = 0;
    }
    if (bgMusicRef.current && bgMusicRef.current.paused && entered) {
      bgMusicRef.current.play().catch(() => undefined);
    }
  }, [clearCrateTimers, entered]);

  const startCrateSequence = useCallback(() => {
    clearCrateTimers();
    setCrateLandingTarget(getCrateLandingTarget());
    setGiftRevealActive(true);

    setCratePhase("falling");
    playSound(whooshAudioRef.current);
    scrollToReveal(GIFT_CRATE_SEQUENCE.fallDurationMs);

    crateTimersRef.current = [
      window.setTimeout(() => {
        setCratePhase("impact");
        playSound(impactAudioRef.current);
        vibrateForImpact();
      }, GIFT_CRATE_SEQUENCE.fallDurationMs),
      window.setTimeout(() => {
        setCratePhase("cracked");
      }, GIFT_CRATE_SEQUENCE.fallDurationMs + GIFT_CRATE_SEQUENCE.impactDurationMs),
    ];
  }, [clearCrateTimers, getCrateLandingTarget, playSound, scrollToReveal]);

  const stopListening = useCallback(async () => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      await audioContextRef.current.close().catch(() => undefined);
    }

    audioContextRef.current = null;
  }, []);

  const completeWish = useCallback(() => {
    if (completedRef.current) {
      return;
    }

    completedRef.current = true;
    setManualBlowing(false);
    setExtinguished(true);
    setMicStatus("success");
    setMeter(1);
    void stopListening();

    sequenceTimerRef.current = window.setTimeout(() => {
      fireConfetti();
      startCrateSequence();
    }, 3500);
  }, [startCrateSequence, stopListening]);

  const startCelebration = useCallback(async () => {
    completedRef.current = false;
    detectorRef.current = createBlowDetector();
    resetCrateSequence();
    setEntered(true);
    setExtinguished(false);
    setMeter(0);
    setPermissionMessage("");
    setMicStatus("requesting");

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus("unsupported");
      setPermissionMessage("This browser does not expose microphone input here.");
      return;
    }

    const AudioContextClass =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: AudioContextFactory }).webkitAudioContext;

    if (!AudioContextClass) {
      setMicStatus("unsupported");
      setPermissionMessage("This browser cannot analyze microphone audio.");
      return;
    }

    try {
      await stopListening();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);

      const timeData = new Uint8Array(analyser.fftSize);

      streamRef.current = stream;
      audioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      setHasStarted(true);
      setMicStatus("calibrating");

      const sampleAudio = () => {
        analyser.getByteTimeDomainData(timeData);
        const volume = getAudioVolume(timeData);

        const result = detectorRef.current.processFrame({
          timestampMs: performance.now(),
          rms: volume.rms,
          peak: volume.peak,
          lowEnergy: 0,
          midEnergy: 0,
          highEnergy: 0,
        });

        setMicStatus(result.status);
        setMeter(getBlowMeterValue(result));

        if (result.accepted) {
          completeWish();
          return;
        }

        rafRef.current = window.requestAnimationFrame(sampleAudio);
      };

      rafRef.current = window.requestAnimationFrame(sampleAudio);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      await stopListening();
      setMeter(0);

      if (name === "NotAllowedError" || name === "SecurityError") {
        setMicStatus("denied");
        setPermissionMessage("Use the manual candle if microphone access is blocked.");
        return;
      }

      setMicStatus("error");
      setPermissionMessage("The microphone stream stopped before the wish was complete.");
    }
  }, [completeWish, resetCrateSequence, stopListening]);

  const relight = useCallback(() => {
    void startCelebration();
  }, [startCelebration]);

  const startManualBlow = useCallback(() => {
    if (completedRef.current) {
      return;
    }

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setEntered(true);
    setHasStarted(true);
    setExtinguished(false);
    setManualBlowing(true);
    setPermissionMessage("");
    manualFallbackStatusRef.current = micStatus;
    detectorRef.current = createBlowDetector({ calibrationFrames: 0 });

    const sampleManualBlow = () => {
      const result = detectorRef.current.processFrame({
        timestampMs: performance.now(),
        rms: 0.45,
        peak: 0.82,
        lowEnergy: 0,
        midEnergy: 0,
        highEnergy: 0,
      });

      setMicStatus(result.status);
      setMeter(getBlowMeterValue(result));

      if (result.accepted) {
        completeWish();
        return;
      }

      rafRef.current = window.requestAnimationFrame(sampleManualBlow);
    };

    rafRef.current = window.requestAnimationFrame(sampleManualBlow);
  }, [completeWish, micStatus]);

  const stopManualBlow = useCallback(() => {
    setManualBlowing(false);

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!completedRef.current) {
      setMeter(0);
      setMicStatus(manualFallbackStatusRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      void stopListening();
      clearCrateTimers();

      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [clearCrateTimers, stopListening]);

  useEffect(() => {
    whooshAudioRef.current = new Audio("/sounds/crate-whoosh.wav");
    impactAudioRef.current = new Audio("/sounds/crate-impact.wav");
    bgMusicRef.current = new Audio("/sounds/happy-birthday.mp3");
    loveBgmRef.current = new Audio("/sounds/love_bgm.mp3");
    whooshAudioRef.current.preload = "auto";
    impactAudioRef.current.preload = "auto";
    if (bgMusicRef.current) {
      bgMusicRef.current.preload = "auto";
      bgMusicRef.current.loop = true;
      bgMusicRef.current.volume = 0.4;
    }
    if (loveBgmRef.current) {
      loveBgmRef.current.preload = "auto";
      loveBgmRef.current.loop = true;
      loveBgmRef.current.volume = 0.4;
    }
    whooshAudioRef.current.volume = 0.55;
    impactAudioRef.current.volume = 0.76;
  }, []);

  useEffect(() => {
    if (!entered || extinguished) {
      if (flameRafRef.current !== null) {
        window.cancelAnimationFrame(flameRafRef.current);
        flameRafRef.current = null;
      }
      return;
    }

    const tick = (timestampMs: number) => {
      setFlameTimeMs(timestampMs);
      flameRafRef.current = window.requestAnimationFrame(tick);
    };

    flameRafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (flameRafRef.current !== null) {
        window.cancelAnimationFrame(flameRafRef.current);
        flameRafRef.current = null;
      }
    };
  }, [entered, extinguished]);

  useEffect(() => {
    if (entered && bgMusicRef.current?.paused) {
      bgMusicRef.current.play().catch(() => undefined);
    }
  }, [entered]);

  const canUseManualFallback = micStatus === "denied" || micStatus === "unsupported" || micStatus === "error";
  const showManualFallback = (canUseManualFallback || manualBlowing) && !extinguished;
  const meterLabel = Math.round(meter * 100);
  const stageClassName = [
    "birthday-stage",
    entered ? "is-entered" : "",
    meter >= 0.18 && !extinguished ? "is-blowing" : "",
    extinguished ? "is-celebrating" : "",
    giftRevealActive ? "is-gift-revealing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const actionLabel = useMemo(() => {
    if (micStatus === "requesting") {
      return "Opening";
    }

    if (entered && !extinguished) {
      return "Listening";
    }

    return "Enter celebration";
  }, [entered, extinguished, micStatus]);

  const handleCrateOpen = useCallback(() => {
    if (bgMusicRef.current) {
      bgMusicRef.current.pause();
    }
    if (loveBgmRef.current) {
      loveBgmRef.current.currentTime = 0;
      loveBgmRef.current.play().catch(() => undefined);
    }
  }, []);

  return (
    <main className={stageClassName}>
      {!hasStarted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a100c]/90 backdrop-blur-md p-4">
          <div className="bg-[#2a1c15] border border-[#D4A24C]/20 p-8 rounded-3xl max-w-md w-full shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-[#D4A24C]/5 to-transparent pointer-events-none" />
            
            <div className="w-16 h-16 bg-[#D4A24C]/10 rounded-full flex items-center justify-center mb-6 relative">
              <Mic className="text-[#D4A24C]" size={32} />
              {micStatus === "requesting" && (
                <div className="absolute inset-0 border-2 border-[#D4A24C] rounded-full animate-ping opacity-20" />
              )}
            </div>

            <h2 className="text-3xl font-display font-bold text-[#FFF8E7] mb-4">
              Ready to Celebrate?
            </h2>
            
            <p className="text-[#D4C5A9] mb-8 text-lg leading-relaxed max-w-[280px]">
              We need microphone access so you can blow out the virtual candles and make your wish.
            </p>

            {permissionMessage && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm w-full">
                {permissionMessage}
              </div>
            )}

            <button
              className="w-full bg-[#D4A24C] hover:bg-[#F5DEB3] text-[#1a100c] font-bold py-4 px-8 rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(212,162,76,0.2)] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              onClick={startCelebration}
              disabled={micStatus === "requesting"}
            >
              {micStatus === "requesting" ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  Waiting for access...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Start Celebration
                </>
              )}
            </button>
            
            {(micStatus === 'denied' || micStatus === 'unsupported' || micStatus === 'error') && (
              <button 
                className="mt-6 text-[#D4C5A9]/60 hover:text-[#D4C5A9] text-sm underline underline-offset-4 transition-colors"
                onClick={startManualBlow}
              >
                Continue without microphone
              </button>
            )}
          </div>
        </div>
      )}

      {cratePhase === "falling" || cratePhase === "impact" ? (
        <GiftCrateDrop
          phase={cratePhase}
          placement="overlay"
          landingTarget={crateLandingTarget}
          fallDurationMs={GIFT_CRATE_SEQUENCE.fallDurationMs}
          onOpen={handleCrateOpen}
        />
      ) : null}

      <div className="birthday-backdrop" aria-hidden="true">
        <div className="wall-pattern" />
        <div className="streamer streamer-left" />
        <div className="streamer streamer-right" />
        <div className="balloon balloon-rose" />
        <div className="balloon balloon-blue" />
        <div className="balloon balloon-gold" />
        <div className="garland garland-one" />
        <div className="garland garland-two" />
      </div>

      <section className="birthday-content" aria-labelledby="birthday-title">
        <div className="scene-copy">
          <p className="eyebrow">
            <Gift aria-hidden="true" size={18} strokeWidth={2.4} />
            Birthday room is ready
          </p>
          <h1 id="birthday-title">Happy Birthday</h1>
          <p className="scene-subtitle">Make a wish, then blow toward the candle.</p>
        </div>

        <div className="cake-scene">
          <div className="cake-light" aria-hidden="true" />
          <CakeIllustration lit={entered} extinguished={extinguished} blowLevel={meter} flameTimeMs={flameTimeMs} />
        </div>

        <section className="control-dock" aria-label="Birthday candle controls">
          <div className="status-row" aria-live="polite">
            <span className="status-icon">
              <StatusIcon status={micStatus} />
            </span>
            <span>{STATUS_COPY[micStatus]}</span>
          </div>

          {permissionMessage ? <p className="permission-note">{permissionMessage}</p> : null}

          <div className="action-row">
            {extinguished ? (
              <button className="primary-action" type="button" onClick={relight} disabled={micStatus === "requesting"}>
                <Sparkles aria-hidden="true" size={20} strokeWidth={2.4} />
                Relight candle
              </button>
            ) : null}

            {showManualFallback ? (
              <button
                className={["secondary-action", manualBlowing ? "is-active" : ""].filter(Boolean).join(" ")}
                type="button"
                onPointerDown={startManualBlow}
                onPointerUp={stopManualBlow}
                onPointerLeave={stopManualBlow}
                onPointerCancel={stopManualBlow}
              >
                <Wind aria-hidden="true" size={20} strokeWidth={2.4} />
                Hold to blow
              </button>
            ) : null}

            {entered && !extinguished && micStatus !== "requesting" && !canUseManualFallback && !manualBlowing ? (
              <button className="quiet-action" type="button" onClick={relight}>
                <RefreshCw aria-hidden="true" size={18} strokeWidth={2.3} />
                Restart
              </button>
            ) : null}
          </div>

          {extinguished ? (
            <p className="success-message" aria-live="polite">
              Wish sent. Let the celebration begin.
            </p>
          ) : null}
        </section>
      </section>

      <section ref={giftRevealRef} className="gift-reveal-section" aria-labelledby="gift-reveal-title">
        <div className="gift-reveal-copy">
          <p className="eyebrow gift-reveal-eyebrow">
            <Sparkles aria-hidden="true" size={18} strokeWidth={2.4} />
            A surprise landed
          </p>
          <h2 id="gift-reveal-title">Your wish opened the gift</h2>
          <p className="gift-reveal-message">
            The candle is out, the crate has cracked open, and the celebration is just getting started.
          </p>
        </div>

        <div ref={giftRevealStageRef} className="gift-reveal-stage" aria-hidden="true">
          <div className="gift-reveal-glow" />
          {cratePhase === "cracked" ? (
            <GiftCrateDrop 
              phase={cratePhase} 
              placement="landed" 
              fallDurationMs={GIFT_CRATE_SEQUENCE.fallDurationMs} 
              onOpen={handleCrateOpen} 
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
