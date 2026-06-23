export type CandleFlameFrameInput = {
  lit: boolean;
  extinguished: boolean;
  timestampMs: number;
  blowLevel: number;
};

export type CandleFlameFrame = {
  flame: {
    opacity: number;
    transform: string;
  };
  glowOpacity: number;
};

export type CandleFumePuff = {
  leftPx: number;
  leftCqw: string;
  sizePx: number;
  sizeCqw: string;
  delayMs: number;
};

export type CandleFumeMotion = {
  durationMs: number;
  riseCqw: string;
  endScale: number;
  repeats: boolean;
};

const REFERENCE_CAKE_WIDTH_PX = 300;

function toCqw(valuePx: number) {
  // Returns raw px to avoid browser container query bugs inside max() or absolute positioning
  return `${formatNumber(valuePx)}px`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number) {
  return String(Number(value.toFixed(3)));
}

const CANDLE_FUME_PUFFS: CandleFumePuff[] = [
  { leftPx: -7, leftCqw: toCqw(-7), sizePx: 14, sizeCqw: toCqw(14), delayMs: 0 },
  { leftPx: -4, leftCqw: toCqw(-4), sizePx: 14, sizeCqw: toCqw(14), delayMs: 120 },
  { leftPx: -10, leftCqw: toCqw(-10), sizePx: 14, sizeCqw: toCqw(14), delayMs: 240 },
];

const CANDLE_FUME_MOTION: CandleFumeMotion = {
  durationMs: 3000,
  riseCqw: toCqw(-120),
  endScale: 1.7,
  repeats: true,
};

function hiddenFlame(glowOpacity: number): CandleFlameFrame {
  return {
    flame: {
      opacity: 0,
      transform: "translate(-50%, -100%) scale(0.3)",
    },
    glowOpacity,
  };
}

export function getCandleFlameFrame({
  lit,
  extinguished,
  timestampMs,
  blowLevel,
}: CandleFlameFrameInput): CandleFlameFrame {
  if (!lit) {
    return hiddenFlame(0);
  }

  if (extinguished) {
    return hiddenFlame(0.15);
  }

  const volume = Number.isFinite(blowLevel) ? clamp(blowLevel, 0, 1) : 0;
  const idleLean = Math.sin(timestampMs / 140) * 2.4 + Math.sin(timestampMs / 53) * 1.1;
  const blowLean = Math.min(volume * 55, 42);
  const lean = idleLean + blowLean;
  const scaleY = Math.max(0.35, 1 - volume * 0.9 + Math.sin(timestampMs / 95) * 0.03);
  const scaleX = Math.max(0.6, 1 - volume * 0.3);
  const opacity = Math.max(0.15, 1 - volume * 1.1);

  return {
    flame: {
      opacity: Number(formatNumber(opacity)),
      transform: `translate(-50%, -100%) rotate(${formatNumber(lean)}deg) scale(${formatNumber(scaleX)}, ${formatNumber(scaleY)})`,
    },
    glowOpacity: 1,
  };
}

export function getCandleFumePuffs() {
  return CANDLE_FUME_PUFFS;
}

export function getCandleFumeMotion() {
  return CANDLE_FUME_MOTION;
}

// Per-candle flicker de-sync offsets (ms). Index 0 = leading candle.
const FLICKER_OFFSETS: readonly number[] = [0, 180, 340, 90, 250];

export const CANDLE_COUNT = 5;

/**
 * Returns a timestamp offset in ms for candle at `index` so that no two
 * candles flicker in sync. Pass the returned value as:
 *   getCandleFlameFrame({ timestampMs: flameTimeMs + getCandleFlameOffset(i), ... })
 */
export function getCandleFlameOffset(index: number): number {
  return FLICKER_OFFSETS[index] ?? 0;
}
