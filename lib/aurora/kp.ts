import { getTonightOutlook } from './outlook';

// Kp activity tiers — used by getKpTier and ViewingWindow.
// Kp cutoffs: quiet <4 · moderate 4–4.9 · active 5–5.9 · storm ≥6
export const AURORA_TIERS = {
  quiet:    { color: '#22c55e', label: 'Quiet'    },
  moderate: { color: '#eab308', label: 'Moderate' },
  active:   { color: '#f97316', label: 'Active'   },
  storm:    { color: '#a78bfa', label: 'Storm'    },
} as const;

export type AuroraTier = keyof typeof AURORA_TIERS;

/** Map a Kp index (0–9) to the canonical activity tier. */
export function getKpTier(kp: number): AuroraTier {
  if (kp >= 6) return 'storm';
  if (kp >= 5) return 'active';
  if (kp >= 4) return 'moderate';
  return 'quiet';
}

/** Cloud cover color for display: green < 30%, amber < 60%, slate otherwise. */
export function cloudCoverColor(pct: number): string {
  if (pct < 30) return "#22c55e";
  if (pct < 60) return "#eab308";
  return "#94a3b8";
}

// Regional risk level for visibility (used by alerts UI + header badge).
export function getAuroraRiskLevel(
  kp: number | null,
  maxAuroraProbNA: number | null,
  bz: number | null,
  solarWindSpeed?: number | null
): "Quiet" | "Moderate" | "High" {
  if (kp === null) return "Quiet";
  const prob = maxAuroraProbNA ?? 0;
  const b = bz ?? 0;
  const highSpeed = solarWindSpeed != null && solarWindSpeed > 600;
  if (kp >= 5 || prob >= 25 || b <= -8 || (kp >= 4 && highSpeed)) return "High";
  if (kp >= 4 || prob >= 15 || b <= -5 || (kp >= 3 && highSpeed)) return "Moderate";
  return "Quiet";
}

/**
 * Plain-English aurora guidance for the northern US, incorporating Kp + OVATION prob + Bz.
 * Derives tier and base message from getTonightOutlook (CME/flare-aware), then appends
 * Bz/speed/prob suffix notes and the forecastPeakKp note.
 */
export function getAuroraGuidance(
  kp: number | null,
  maxProb: number | null,
  bz: number | null,
  solarWindSpeed?: number | null,
  forecastPeakKp?: number | null
): string {
  if (kp === null) return "Data loading...";
  const effectiveKp = forecastPeakKp != null ? Math.max(kp, forecastPeakKp) : kp;
  const highSpeed = solarWindSpeed != null && solarWindSpeed > 600;

  let text = getTonightOutlook(effectiveKp, bz, maxProb, [], null, solarWindSpeed ?? null).message;

  if (bz !== null && bz <= -5) {
    text += " Strong southward Bz currently boosting chances.";
  } else if (highSpeed) {
    text += " Elevated solar wind speed may enhance activity if Bz turns southward.";
  } else if (maxProb !== null && maxProb >= 20) {
    text += " Elevated probabilities across North America increase the odds.";
  }

  if (forecastPeakKp != null && forecastPeakKp > kp + 0.5) {
    text += ` Kp ${forecastPeakKp.toFixed(1)} forecast as tonight's peak.`;
  }

  return text;
}
