import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBlowDetector, type BlowFrame } from "./blow-detector.ts";

function ambient(count = 16): BlowFrame[] {
  return Array.from({ length: count }, (_, index) => ({
    timestampMs: index * 40,
    rms: 0.012 + (index % 2) * 0.001,
    lowEnergy: 0.04,
    midEnergy: 0.035,
    highEnergy: 0.025,
  }));
}

function runFrames(frames: BlowFrame[]) {
  const detector = createBlowDetector({
    calibrationFrames: 12,
    requiredDurationMs: 320,
  });

  return frames.map((frame) => detector.processFrame(frame));
}

describe("createBlowDetector", () => {
  it("reports calibration status before the ambient baseline is ready", () => {
    const results = runFrames(ambient(6));

    assert.deepEqual({
      accepted: results.at(-1)?.accepted,
      status: results.at(-1)?.status,
      progress: results.at(-1)?.progress,
    }, {
      accepted: false,
      status: "calibrating",
      progress: 0,
    });
  });

  it("rejects quiet ambient input after calibration", () => {
    const results = runFrames([
      ...ambient(),
      ...Array.from({ length: 24 }, (_, index) => ({
        timestampMs: 640 + index * 40,
        rms: 0.017,
        lowEnergy: 0.05,
        midEnergy: 0.04,
        highEnergy: 0.03,
      })),
    ]);

    assert.deepEqual({
      accepted: results.at(-1)?.accepted,
      status: results.at(-1)?.status,
    }, {
      accepted: false,
      status: "listening",
    });
  });

  it("rejects a single loud spike such as a clap or tap", () => {
    const results = runFrames([
      ...ambient(),
      {
        timestampMs: 680,
        rms: 0.72,
        lowEnergy: 0.8,
        midEnergy: 0.72,
        highEnergy: 0.64,
      },
      {
        timestampMs: 720,
        rms: 0.015,
        lowEnergy: 0.04,
        midEnergy: 0.035,
        highEnergy: 0.025,
      },
    ]);

    assert.equal(results.some((result) => result.accepted), false);
  });

  it("accepts a normal blow after about one third second above the calibrated threshold", () => {
    const results = runFrames([
      ...ambient(),
      ...Array.from({ length: 10 }, (_, index) => ({
        timestampMs: 680 + index * 40,
        rms: 0.13,
        lowEnergy: 0.72,
        midEnergy: 0.16,
        highEnergy: 0.08,
      })),
    ]);

    assert.equal(results.some((result) => result.accepted), true);
  });

  it("accepts a short sharp puff through accumulated blow strength", () => {
    const results = runFrames([
      ...ambient(),
      ...Array.from({ length: 8 }, (_, index) => ({
        timestampMs: 680 + index * 40,
        rms: 1,
        lowEnergy: 0.8,
        midEnergy: 0.12,
        highEnergy: 0.08,
      })),
    ]);

    assert.equal(results.some((result) => result.accepted), true);
  });

  it("accepts sustained breath-like audio above the calibrated baseline", () => {
    const results = runFrames([
      ...ambient(),
      ...Array.from({ length: 26 }, (_, index) => ({
        timestampMs: 680 + index * 40,
        rms: 0.125 + Math.sin(index * 0.85) * 0.018,
        lowEnergy: 0.18 + Math.sin(index * 0.5) * 0.02,
        midEnergy: 0.48 + Math.sin(index * 0.7) * 0.04,
        highEnergy: 0.58 + Math.cos(index * 0.4) * 0.04,
      })),
    ]);

    assert.equal(results.some((result) => result.accepted), true);
    assert.equal(results.at(-1)?.progress, 1);
  });

  it("accepts sustained broad-band breath from a real microphone profile", () => {
    const results = runFrames([
      ...ambient(),
      ...Array.from({ length: 28 }, (_, index) => ({
        timestampMs: 680 + index * 40,
        rms: 0.11 + Math.sin(index * 0.72) * 0.014,
        lowEnergy: 0.3 + Math.sin(index * 0.38) * 0.018,
        midEnergy: 0.48 + Math.sin(index * 0.61) * 0.034,
        highEnergy: 0.38 + Math.cos(index * 0.47) * 0.03,
      })),
    ]);

    assert.equal(results.some((result) => result.accepted), true);
    assert.equal(results.at(-1)?.status, "success");
  });
});
