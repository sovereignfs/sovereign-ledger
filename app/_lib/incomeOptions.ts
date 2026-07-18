/** `ledger_income_sources.kind`/`cadence` values (LDG-02) — plain-language labels. */
export const INCOME_KIND_OPTIONS = [
  { value: 'fixed', label: 'Fixed — same amount each time' },
  { value: 'dynamic', label: 'Dynamic — amount varies' },
] as const;

export const INCOME_CADENCE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'adhoc', label: 'One-off / irregular' },
] as const;

export function incomeKindLabel(kind: string): string {
  return INCOME_KIND_OPTIONS.find((entry) => entry.value === kind)?.label ?? kind;
}

export function incomeCadenceLabel(cadence: string): string {
  return INCOME_CADENCE_OPTIONS.find((entry) => entry.value === cadence)?.label ?? cadence;
}
