/**
 * Amounts are always stored as integer minor units (SPEC.md's "Money and FX
 * storage") — these helpers are the only place a major-unit string ever
 * touches a float, and only transiently, for the UI layer. Assumes a 2-decimal
 * currency (cents), matching sovereign-tally's `dollarsToCents`/`centsToDollars` —
 * no zero-decimal currency (JPY) precedent exists anywhere in this codebase yet.
 */

/** Parses a user-entered major-unit amount into minor units, or null if not a valid positive amount. */
export function majorToMinor(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

export function minorToMajor(minor: number): string {
  return (minor / 100).toFixed(2);
}
