import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getBlowMeterValue } from "./blow-meter.ts";

describe("getBlowMeterValue", () => {
  it("uses the reference volume ratio directly while listening", () => {
    const value = getBlowMeterValue({
      accepted: false,
      status: "listening",
      progress: 0,
      intensity: 0.5,
    });

    assert.equal(value, 0.5);
  });

  it("keeps sustained blow progress visible when it is ahead of volume", () => {
    const value = getBlowMeterValue({
      accepted: false,
      status: "blowing",
      progress: 0.7,
      intensity: 0.4,
    });

    assert.equal(value, 0.7);
  });

  it("returns full meter for an accepted blow", () => {
    assert.equal(getBlowMeterValue({
      accepted: true,
      status: "success",
      progress: 1,
      intensity: 1,
    }), 1);
  });
});
