export type GiftCratePhase = "idle" | "falling" | "impact" | "cracked";

export const GIFT_CRATE_SEQUENCE = {
  fallDurationMs: 5000,
  impactDurationMs: 520,
} as const;
