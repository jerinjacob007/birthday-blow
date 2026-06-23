# Birthday Wish — Cake Design & Blow UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the birthday wish app with a rich 3-tier cake SVG (5 de-synced candles, ganache drips, rosettes), per-candle fume animation on blow-off, and a circular radial-arc blow meter replacing the flat progress bar.

**Architecture:** All changes are contained to three files (`candle-flame.ts`, `birthday-wish-app.tsx`, `globals.css`) plus one new file (`blow-meter-panel.tsx`). The flame and fume animation reuses the existing `getCandleFlameFrame / getCandleFumePuffs / getCandleFumeMotion` APIs with no breaking changes. The new `BlowMeterPanel` is a self-contained presentational component.

**Tech Stack:** Next.js 14 App Router, TypeScript, Lucide React, Vanilla CSS (no new dependencies)

---

## Task 1: Add `getCandleFlameOffset` helper to `candle-flame.ts`

**Files:**
- Modify: `src/lib/candle-flame.ts`
- Test: `src/lib/candle-flame.test.ts`

- [ ] **Step 1.1 — Write the failing test**

  Open `src/lib/candle-flame.test.ts` and add at the end:

  ```ts
  import { getCandleFlameOffset, CANDLE_COUNT } from "./candle-flame";

  describe("getCandleFlameOffset", () => {
    it("returns 0 for index 0", () => {
      expect(getCandleFlameOffset(0)).toBe(0);
    });

    it("returns a positive number for indices 1-4", () => {
      for (let i = 1; i < CANDLE_COUNT; i++) {
        expect(getCandleFlameOffset(i)).toBeGreaterThan(0);
      }
    });

    it("returns unique offsets for each candle", () => {
      const offsets = Array.from({ length: CANDLE_COUNT }, (_, i) => getCandleFlameOffset(i));
      const unique = new Set(offsets);
      expect(unique.size).toBe(CANDLE_COUNT);
    });

    it("CANDLE_COUNT is 5", () => {
      expect(CANDLE_COUNT).toBe(5);
    });
  });
  ```

- [ ] **Step 1.2 — Run test to verify it fails**

  ```bash
  pnpm test src/lib/candle-flame.test.ts
  ```

  Expected: FAIL — `getCandleFlameOffset` and `CANDLE_COUNT` not exported.

- [ ] **Step 1.3 — Add exports to `candle-flame.ts`**

  At the bottom of `src/lib/candle-flame.ts`, append:

  ```ts
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
  ```

- [ ] **Step 1.4 — Run test to verify it passes**

  ```bash
  pnpm test src/lib/candle-flame.test.ts
  ```

  Expected: all 4 new tests PASS.

- [ ] **Step 1.5 — Commit**

  ```bash
  git add src/lib/candle-flame.ts src/lib/candle-flame.test.ts
  git commit -m "feat(candle): export CANDLE_COUNT and getCandleFlameOffset helper"
  ```

---

## Task 2: Rebuild `CakeIllustration` with 3-tier SVG + 5 candles

**Files:**
- Modify: `src/components/birthday-wish-app.tsx` (the `CakeIllustration` component, lines 131–246)
- Modify: `src/app/globals.css` (update `.cake-illustration` aspect-ratio; add `.candle-overlay` CSS)

> The existing `.reference-flame` and `.reference-smoke` CSS classes handle a single candle by anchoring to `left: 50%; top: 15%`. For 5 candles we introduce per-candle flame/smoke wrapper divs with explicit inline `left` positions matching candle wick x-coordinates in the new SVG.

### New SVG candle positions (viewBox 0 0 320 280)

| Candle index | SVG x (wick center) | As % of 320 |
|---|---|---|
| 0 | 102 | 31.875% |
| 1 | 130 | 40.625% |
| 2 | 160 | 50% |
| 3 | 190 | 59.375% |
| 4 | 218 | 68.125% |

- [ ] **Step 2.1 — Replace the `CakeIllustration` component**

  In `src/components/birthday-wish-app.tsx`, replace the entire `CakeIllustration` function (lines 131–246) with:

  ```tsx
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
  ```

- [ ] **Step 2.2 — Update the import line in `birthday-wish-app.tsx`**

  Find the existing candle-flame import and add the two new exports:

  ```ts
  // Before:
  import { getCandleFlameFrame, getCandleFumeMotion, getCandleFumePuffs } from "@/lib/candle-flame";

  // After:
  import { getCandleFlameFrame, getCandleFumeMotion, getCandleFumePuffs, getCandleFlameOffset, CANDLE_COUNT } from "@/lib/candle-flame";
  ```

- [ ] **Step 2.3 — Update `.cake-illustration` aspect-ratio in `globals.css`**

  Find `.cake-illustration` (around line 304) and change:

  ```css
  /* Before */
  aspect-ratio: 300 / 240;

  /* After */
  aspect-ratio: 320 / 280;
  ```

- [ ] **Step 2.4 — Add `.candle-overlay` CSS to `globals.css`**

  Directly after the `.reference-flame { ... }` block (around line 359), add:

  ```css
  .candle-overlay {
    pointer-events: none;
    transform: translateX(-50%);
  }

  .candle-overlay .reference-flame {
    left: 0;
    top: 0;
    transform-origin: 50% 100%;
    transition: opacity 180ms ease, transform 180ms ease;
    will-change: transform, opacity;
  }

  .candle-overlay .reference-smoke {
    left: 0;
    top: 0;
    transform: none;
  }
  ```

- [ ] **Step 2.5 — Check types compile**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 2.6 — Visual check in browser**

  ```bash
  pnpm dev
  ```

  Open `http://localhost:3000`. Verify:
  - 3-tier cake renders with ganache drips, rosettes, pearl accents at desktop and mobile widths.
  - 5 distinct candles visible on the top tier before entering the celebration.

- [ ] **Step 2.7 — Commit**

  ```bash
  git add src/components/birthday-wish-app.tsx src/app/globals.css
  git commit -m "feat(cake): rebuild CakeIllustration with 3-tier SVG and 5 candles"
  ```

---

## Task 3: Multi-candle flame flicker + per-candle fume on blow-off

**Files:**
- Modify: `src/app/globals.css` (add `prefers-reduced-motion` guard for candle overlay smoke)

- [ ] **Step 3.1 — Verify multi-flame RAF wiring**

  In `birthday-wish-app.tsx`, the `flameTimeMs` state is driven by the `useEffect` RAF loop (lines ~589–611). The `CakeIllustration` receives `flameTimeMs` and uses it for all 5 candles — no change needed. Load the app (`pnpm dev`), click "Enter celebration", and verify each candle flame flickers at a slightly different rate (de-synced).

- [ ] **Step 3.2 — Add reduced-motion guard in `globals.css`**

  Append at the end of `globals.css`:

  ```css
  @media (prefers-reduced-motion: reduce) {
    .candle-overlay .reference-smoke.active span {
      animation: none;
      opacity: 0;
    }
  }
  ```

- [ ] **Step 3.3 — Manual blow-off test**

  ```bash
  pnpm dev
  ```

  1. Click "Enter celebration" — grant mic permission (or use "Hold to blow" fallback).
  2. Blow until candle extinguishes.
  3. Verify:
     - All 5 flames go out simultaneously.
     - Smoke puffs rise from each candle wick position, visually staggered (candle 2 smoke starts ~160ms after candle 0).
     - Smoke continues rising for ~2200ms.
     - Confetti fires and gift crate drops in parallel with smoke — not sequential.

- [ ] **Step 3.4 — Commit**

  ```bash
  git add src/app/globals.css
  git commit -m "feat(flame): multi-candle fume animation with reduced-motion guard"
  ```

---

## Task 4: Create `BlowMeterPanel` circular arc component

**Files:**
- Create: `src/components/blow-meter-panel.tsx`
- Modify: `src/app/globals.css` (add all new `.blow-meter-*` styles + keyframes)

The panel renders as a 180×180px circular SVG arc meter:
- Outer arc: `stroke-dashoffset` tracks `meter` 0→1
- Color transitions: `#2563eb` (empty) → `#fbbf24` (mid) → `#f97316` (high) → `#22c55e` (success)
- 3 concentric ring `<circle>`s pulsing when blowing
- Central `<Mic>` icon from lucide-react, scales 1→1.15 when blowing
- 6 wind particle `<span>`s bursting outward when `micStatus === "blowing"`
- Status label below the arc

- [ ] **Step 4.1 — Create `src/components/blow-meter-panel.tsx`**

  ```tsx
  "use client";

  import { Mic, MicOff, Sparkles } from "lucide-react";
  import type { CSSProperties } from "react";

  type BlowMeterStatus =
    | "idle"
    | "requesting"
    | "calibrating"
    | "listening"
    | "blowing"
    | "success"
    | "denied"
    | "unsupported"
    | "error";

  const STATUS_COPY: Record<BlowMeterStatus, string> = {
    idle: "Make a wish",
    requesting: "Opening the celebration",
    calibrating: "Listening to the room",
    listening: "Blow toward the candle",
    blowing: "Keep blowing\u2026",
    success: "The candle is out",
    denied: "Microphone blocked",
    unsupported: "Microphone unavailable",
    error: "Microphone interrupted",
  };

  const ARC_RADIUS = 72;
  const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS; // ~452.4

  interface BlowMeterPanelProps {
    meter: number;       // 0–1
    micStatus: BlowMeterStatus;
    meterLabel: number;  // 0–100 for aria
  }

  export function BlowMeterPanel({ meter, micStatus, meterLabel }: BlowMeterPanelProps) {
    const isBlowing = micStatus === "blowing";
    const isSuccess = micStatus === "success";
    const isError = micStatus === "denied" || micStatus === "unsupported" || micStatus === "error";

    const dashOffset = ARC_CIRCUMFERENCE * (1 - meter);

    const arcColor = isSuccess
      ? "#22c55e"
      : meter > 0.6
        ? "#f97316"
        : meter > 0.3
          ? "#fbbf24"
          : "#2563eb";

    const panelClass = [
      "blow-meter-panel",
      isBlowing ? "is-blowing" : "",
      isSuccess ? "is-success" : "",
      isError ? "is-error" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const micIconStyle: CSSProperties = {
      transform: isBlowing ? "scale(1.15)" : "scale(1)",
      transition: "transform 200ms ease",
    };

    return (
      <div className={panelClass} aria-label={`Blow meter ${meterLabel} percent`}>
        {/* Wind particles */}
        <div className="blow-particles" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              className="wind-particle"
              style={{ "--particle-i": i } as CSSProperties}
            />
          ))}
        </div>

        {/* Circular arc SVG */}
        <svg
          className="blow-arc-svg"
          viewBox="0 0 180 180"
          aria-hidden="true"
          width="180"
          height="180"
        >
          <circle className="blow-ring blow-ring-3" cx="90" cy="90" r="86" />
          <circle className="blow-ring blow-ring-2" cx="90" cy="90" r="78" />
          <circle className="blow-ring blow-ring-1" cx="90" cy="90" r="70" />

          {/* Track */}
          <circle
            cx="90" cy="90" r={ARC_RADIUS}
            fill="none"
            stroke="rgba(251,232,198,0.1)"
            strokeWidth="8"
          />
          {/* Progress arc */}
          <circle
            className="blow-arc"
            cx="90" cy="90" r={ARC_RADIUS}
            fill="none"
            stroke={arcColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={ARC_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "90px 90px",
              transition: "stroke-dashoffset 130ms ease-out, stroke 300ms ease",
            }}
          />
        </svg>

        {/* Centre mic icon */}
        <div className="blow-mic-icon" style={micIconStyle} aria-hidden="true">
          {isError ? (
            <MicOff size={32} strokeWidth={2} />
          ) : isSuccess ? (
            <Sparkles size={32} strokeWidth={2} />
          ) : (
            <Mic size={32} strokeWidth={2} />
          )}
        </div>

        {/* Status label */}
        <p className="blow-status-label" aria-live="polite">
          {STATUS_COPY[micStatus]}
        </p>
      </div>
    );
  }
  ```

- [ ] **Step 4.2 — Add `BlowMeterPanel` CSS to `globals.css`**

  Append at the end of `globals.css` (before the existing `@media (prefers-reduced-motion)` guard added in Task 3):

  ```css
  /* ===========================
     Blow Meter Panel (circular)
     =========================== */

  .blow-meter-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 6px 0 2px;
  }

  .blow-ring {
    fill: none;
    stroke: rgba(37, 99, 235, 0.12);
    stroke-width: 1.5;
    transition: stroke 300ms ease;
  }

  .blow-meter-panel.is-blowing .blow-ring {
    stroke: rgba(249, 115, 22, 0.18);
  }

  .blow-meter-panel.is-success .blow-ring {
    stroke: rgba(34, 197, 94, 0.22);
  }

  .blow-meter-panel.is-blowing .blow-ring-1 {
    animation: ring-pulse 900ms ease-in-out infinite;
  }

  .blow-meter-panel.is-blowing .blow-ring-2 {
    animation: ring-pulse 900ms ease-in-out 200ms infinite;
  }

  .blow-meter-panel.is-blowing .blow-ring-3 {
    animation: ring-pulse 900ms ease-in-out 400ms infinite;
  }

  @keyframes ring-pulse {
    0%, 100% { opacity: 0.4; transform: scale(1);    }
    50%       { opacity: 1;   transform: scale(1.04); }
  }

  .blow-meter-panel.is-success .blow-ring-1 {
    animation: ring-burst 600ms ease-out forwards;
  }

  .blow-meter-panel.is-success .blow-ring-2 {
    animation: ring-burst 600ms ease-out 80ms forwards;
  }

  .blow-meter-panel.is-success .blow-ring-3 {
    animation: ring-burst 600ms ease-out 160ms forwards;
  }

  @keyframes ring-burst {
    0%   { opacity: 1;   transform: scale(1);    }
    60%  { opacity: 0.6; transform: scale(1.12); }
    100% { opacity: 0;   transform: scale(1.25); }
  }

  .blow-arc-svg {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    overflow: visible;
  }

  .blow-mic-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -58%);
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    color: #fff7ed;
    background: rgba(37, 99, 235, 0.28);
    border-radius: 50%;
    box-shadow: 0 0 24px rgba(37, 99, 235, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.2);
    transition: background 300ms ease, box-shadow 300ms ease;
  }

  .blow-meter-panel.is-blowing .blow-mic-icon {
    background: rgba(249, 115, 22, 0.28);
    box-shadow: 0 0 24px rgba(249, 115, 22, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.2);
  }

  .blow-meter-panel.is-success .blow-mic-icon {
    background: rgba(34, 197, 94, 0.28);
    box-shadow: 0 0 24px rgba(34, 197, 94, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.2);
  }

  .blow-status-label {
    margin: 96px 0 0;
    color: #fbd7b0;
    font-size: 0.92rem;
    font-weight: 750;
    text-align: center;
  }

  .blow-particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .wind-particle {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 6px;
    height: 6px;
    background: rgba(249, 115, 22, 0.7);
    border-radius: 50%;
    opacity: 0;
  }

  .blow-meter-panel.is-blowing .wind-particle {
    animation: wind-burst 700ms ease-out infinite;
    animation-delay: calc(var(--particle-i) * 110ms);
  }

  @keyframes wind-burst {
    0% {
      opacity: 0.9;
      transform: translate(-50%, -50%) rotate(calc(var(--particle-i) * 60deg)) translateX(0);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) rotate(calc(var(--particle-i) * 60deg)) translateX(52px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .blow-ring,
    .blow-meter-panel.is-blowing .blow-ring-1,
    .blow-meter-panel.is-blowing .blow-ring-2,
    .blow-meter-panel.is-blowing .blow-ring-3,
    .blow-meter-panel.is-success .blow-ring-1,
    .blow-meter-panel.is-success .blow-ring-2,
    .blow-meter-panel.is-success .blow-ring-3 {
      animation: none;
    }

    .wind-particle,
    .blow-meter-panel.is-blowing .wind-particle {
      animation: none;
      opacity: 0;
    }
  }
  ```

- [ ] **Step 4.3 — Type-check**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 4.4 — Commit**

  ```bash
  git add src/components/blow-meter-panel.tsx src/app/globals.css
  git commit -m "feat(meter): add BlowMeterPanel circular arc component with wind particles"
  ```

---

## Task 5: Integrate `BlowMeterPanel` into `BirthdayWishApp`

**Files:**
- Modify: `src/components/birthday-wish-app.tsx`
- Modify: `src/app/globals.css` (remove unused meter CSS rules)

- [ ] **Step 5.1 — Add import**

  At the top of `src/components/birthday-wish-app.tsx`, add:

  ```ts
  import { BlowMeterPanel } from "@/components/blow-meter-panel";
  ```

- [ ] **Step 5.2 — Replace the meter + status JSX**

  In the `return` of `BirthdayWishApp`, inside `.control-dock`:

  **Remove** the `.status-row` block:
  ```tsx
  // DELETE:
  <div className="status-row" aria-live="polite">
    <span className="status-icon">
      <StatusIcon status={micStatus} />
    </span>
    <span>{STATUS_COPY[micStatus]}</span>
  </div>
  ```

  **Remove** the `.meter-shell` block:
  ```tsx
  // DELETE:
  <div className="meter-shell" aria-label={`Blow meter ${meterLabel} percent`}>
    <div className="meter-track">
      <div className="meter-fill" style={{ width: `${meterLabel}%` }} />
    </div>
    <span className="meter-value">{meterLabel}%</span>
  </div>
  ```

  **Add** `<BlowMeterPanel>` in their place:
  ```tsx
  // INSERT where the two blocks above were:
  <BlowMeterPanel meter={meter} micStatus={micStatus} meterLabel={meterLabel} />
  ```

- [ ] **Step 5.3 — Remove unused CSS from `globals.css`**

  Delete these rule blocks (they are fully replaced):

  ```
  .status-row  { ... }
  .status-icon { ... }
  .meter-shell { ... }
  .meter-track { ... }
  .meter-fill  { ... }
  .meter-value { ... }
  ```

- [ ] **Step 5.4 — Type-check + lint**

  ```bash
  pnpm typecheck && pnpm lint
  ```

  If lint flags `StatusIcon` or `STATUS_COPY` as unused in `birthday-wish-app.tsx`, delete those declarations.

- [ ] **Step 5.5 — Full manual flow test**

  ```bash
  pnpm dev
  ```

  1. **Landing** — arc empty, Mic icon centred, "Make a wish" label.
  2. **Click "Enter celebration"** — label changes to "Listening to the room".
  3. **Blow into mic** — arc fills blue→orange, wind particles burst, rings pulse, label "Keep blowing…".
  4. **Candle extinguishes** — arc flashes green, rings burst, Sparkles icon, "The candle is out", confetti fires.
  5. **Mic denied** — MicOff icon, "Microphone blocked".
  6. **"Hold to blow" fallback** — arc fills and candle extinguishes correctly.

- [ ] **Step 5.6 — Commit**

  ```bash
  git add src/components/birthday-wish-app.tsx src/app/globals.css
  git commit -m "feat(ui): integrate BlowMeterPanel, remove flat meter bar"
  ```

---

## Task 6: Final verification

- [ ] **Step 6.1 — Full lint + typecheck**

  ```bash
  pnpm lint && pnpm typecheck
  ```

  Expected: zero errors.

- [ ] **Step 6.2 — Unit tests**

  ```bash
  pnpm test
  ```

  Expected: all existing tests pass + 4 new `getCandleFlameOffset` tests pass.

- [ ] **Step 6.3 — Mobile viewport check**

  In browser DevTools, simulate 390×844 (iPhone 14). Verify:
  - 3-tier cake fits without horizontal scroll.
  - `BlowMeterPanel` arc is fully visible in the control dock.
  - 5 candles are legible at mobile scale.

- [ ] **Step 6.4 — Final commit**

  ```bash
  git add -A
  git commit -m "chore: final cleanup and verification for cake + blow meter UI"
  ```
