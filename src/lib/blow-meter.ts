import type { BlowDetectorResult } from "./blow-detector.ts";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getBlowMeterValue(result: BlowDetectorResult) {
  if (result.accepted || result.status === "success") {
    return 1;
  }

  return clamp(Math.max(result.progress, result.intensity), 0, 1);
}
