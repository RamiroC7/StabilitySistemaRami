/**
 * Detects if the last 3 RPE values indicate an anomaly.
 * Returns "high" if all 3 are >= 8 (very high effort)
 * Returns "low" if all 3 are <= 3 (very low effort)
 * Returns null otherwise
 */
export function detectRpeAlert(
  lastThreeRpes: (number | null)[],
): "high" | "low" | null {
  const valid = lastThreeRpes.filter((r): r is number => r !== null);
  if (valid.length < 3) return null;
  if (valid.every((r) => r >= 8)) return "high";
  if (valid.every((r) => r <= 3)) return "low";
  return null;
}
