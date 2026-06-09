// @lifecycle ACTIVE — Shared utility: Wald confidence interval for a proportion

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  width: number;
}

/**
 * Compute a Wald confidence interval for a proportion.
 *
 * @param p - observed proportion (0-1)
 * @param n - sample size
 * @param z - z-score for confidence level (default 1.96 for 95% confidence)
 */
export function getConfidenceInterval(
  p: number,
  n: number,
  z: number = 1.96,
): ConfidenceInterval {
  if (n < 1) {
    return { lower: 0, upper: 100, width: 100 };
  }

  const margin = z * Math.sqrt((p * (1 - p)) / n);

  return {
    lower: Math.max(0, Math.round((p - margin) * 100)),
    upper: Math.min(100, Math.round((p + margin) * 100)),
    width: Math.round(margin * 100),
  };
}
