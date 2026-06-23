export type BlowFrame = {
  timestampMs: number;
  rms: number;
  peak?: number;
  lowEnergy: number;
  midEnergy: number;
  highEnergy: number;
};

export type BlowStatus = "calibrating" | "listening" | "blowing" | "success";

export type BlowDetectorOptions = {
  calibrationFrames?: number;
  requiredDurationMs?: number;
  strengthThreshold?: number;
};

export type BlowDetectorResult = {
  accepted: boolean;
  status: BlowStatus;
  progress: number;
  intensity: number;
};

export type BlowDetector = {
  processFrame(frame: BlowFrame): BlowDetectorResult;
  reset(): void;
};

const DEFAULT_OPTIONS: Required<BlowDetectorOptions> = {
  calibrationFrames: 24,
  requiredDurationMs: 320,
  strengthThreshold: 1,
};

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getReferenceThreshold(ambientLevel: number) {
  return Math.min(0.3, Math.max(0.05, ambientLevel * 2.2 + 0.025));
}

function getReferenceVolume(frame: BlowFrame) {
  return Math.max(frame.rms, (frame.peak ?? 0) * 0.55);
}

export function createBlowDetector(options: BlowDetectorOptions = {}): BlowDetector {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const ambientSamples: number[] = [];

  let ambientLevel = 0.02;
  let threshold = 0.09;
  let lastTimestampMs = 0;
  let smoothedVolume = 0;
  let sustainAboveSeconds = 0;
  let blowStrength = 0;
  let accepted = false;

  const resetBreath = () => {
    sustainAboveSeconds = 0;
    blowStrength = 0;
    smoothedVolume = 0;
    lastTimestampMs = 0;
  };

  const reset = () => {
    ambientSamples.length = 0;
    ambientLevel = 0.02;
    threshold = 0.09;
    accepted = false;
    resetBreath();
  };

  const processFrame = (frame: BlowFrame): BlowDetectorResult => {
    if (accepted) {
      return {
        accepted: true,
        status: "success",
        progress: 1,
        intensity: 1,
      };
    }

    const volume = getReferenceVolume(frame);

    if (ambientSamples.length < settings.calibrationFrames) {
      ambientSamples.push(volume);
      ambientLevel = average(ambientSamples);
      threshold = getReferenceThreshold(ambientLevel);

      return {
        accepted: false,
        status: "calibrating",
        progress: 0,
        intensity: 0,
      };
    }

    if (!lastTimestampMs) {
      lastTimestampMs = frame.timestampMs;
    }

    const dt = Math.min(0.05, (frame.timestampMs - lastTimestampMs) / 1000) || 0.016;
    lastTimestampMs = frame.timestampMs;
    smoothedVolume = smoothedVolume * 0.55 + volume * 0.45;

    const intensity = clamp(smoothedVolume / (threshold * 1.6), 0, 1);

    if (smoothedVolume > threshold) {
      sustainAboveSeconds += dt;
      blowStrength += (smoothedVolume - threshold) * dt * 4.2;
    } else {
      sustainAboveSeconds = Math.max(0, sustainAboveSeconds - dt * 1.5);
      blowStrength = Math.max(0, blowStrength - dt * 0.9);
      ambientLevel = ambientLevel * 0.98 + volume * 0.02;
      threshold = getReferenceThreshold(ambientLevel);
    }

    const sustainProgress = sustainAboveSeconds / (settings.requiredDurationMs / 1000);
    const strengthProgress = blowStrength / settings.strengthThreshold;
    const progress = clamp(Math.max(sustainProgress, strengthProgress), 0, 1);

    if (sustainProgress >= 1 || strengthProgress >= 1) {
      accepted = true;

      return {
        accepted: true,
        status: "success",
        progress: 1,
        intensity: 1,
      };
    }

    return {
      accepted: false,
      status: smoothedVolume > threshold ? "blowing" : "listening",
      progress,
      intensity,
    };
  };

  return {
    processFrame,
    reset,
  };
}
