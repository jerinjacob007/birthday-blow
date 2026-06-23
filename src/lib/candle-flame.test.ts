import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCandleFlameFrame, getCandleFumeMotion, getCandleFumePuffs, getCandleFlameOffset, CANDLE_COUNT } from "./candle-flame.ts";

describe("getCandleFlameFrame", () => {
  it("keeps the copied reference flame hidden before the candle is lit", () => {
    const frame = getCandleFlameFrame({
      lit: false,
      extinguished: false,
      timestampMs: 0,
      blowLevel: 0,
    });

    assert.equal(frame.flame.opacity, 0);
    assert.equal(frame.flame.transform, "translate(-50%, -100%) scale(0.3)");
    assert.equal(frame.glowOpacity, 0);
  });

  it("uses the copied reference idle sway formula while lit", () => {
    const frame = getCandleFlameFrame({
      lit: true,
      extinguished: false,
      timestampMs: 0,
      blowLevel: 0,
    });

    assert.equal(frame.flame.opacity, 1);
    assert.equal(frame.flame.transform, "translate(-50%, -100%) rotate(0deg) scale(1, 1)");
    assert.equal(frame.glowOpacity, 1);
  });

  it("leans, shrinks, and fades the flame with the copied blow animation math", () => {
    const frame = getCandleFlameFrame({
      lit: true,
      extinguished: false,
      timestampMs: 0,
      blowLevel: 0.5,
    });

    assert.equal(frame.flame.opacity, 0.45);
    assert.equal(frame.flame.transform, "translate(-50%, -100%) rotate(27.5deg) scale(0.85, 0.55)");
  });

  it("collapses the flame and leaves smoke glow after the candle is out", () => {
    const frame = getCandleFlameFrame({
      lit: true,
      extinguished: true,
      timestampMs: 2000,
      blowLevel: 1,
    });

    assert.equal(frame.flame.opacity, 0);
    assert.equal(frame.flame.transform, "translate(-50%, -100%) scale(0.3)");
    assert.equal(frame.glowOpacity, 0.15);
  });
});

describe("getCandleFumePuffs", () => {
  it("matches and scales the original attached smoke/fume puff layout", () => {
    assert.deepEqual(getCandleFumePuffs(), [
      { leftPx: -7, leftCqw: "-7px", sizePx: 14, sizeCqw: "14px", delayMs: 0 },
      { leftPx: -4, leftCqw: "-4px", sizePx: 14, sizeCqw: "14px", delayMs: 120 },
      { leftPx: -10, leftCqw: "-10px", sizePx: 14, sizeCqw: "14px", delayMs: 240 },
    ]);
  });

  it("keeps the original fume rise motion visible while the candle is out", () => {
    assert.deepEqual(getCandleFumeMotion(), {
      durationMs: 3000,
      riseCqw: "-120px",
      endScale: 1.7,
      repeats: true,
    });
  });
});

describe("getCandleFlameOffset", () => {
  it("returns 0 for index 0", () => {
    assert.equal(getCandleFlameOffset(0), 0);
  });

  it("returns a positive number for indices 1-4", () => {
    for (let i = 1; i < CANDLE_COUNT; i++) {
      assert.ok(getCandleFlameOffset(i) > 0, `Expected getCandleFlameOffset(${i}) > 0`);
    }
  });

  it("returns unique offsets for each candle", () => {
    const offsets = Array.from({ length: CANDLE_COUNT }, (_, i) => getCandleFlameOffset(i));
    const unique = new Set(offsets);
    assert.equal(unique.size, CANDLE_COUNT);
  });

  it("CANDLE_COUNT is 5", () => {
    assert.equal(CANDLE_COUNT, 5);
  });
});
