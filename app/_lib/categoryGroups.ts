/** `ledger_categories.group` values (LDG-03) — plain-language labels for the UI. */
export const CATEGORY_GROUPS = [
  { value: 'dynamic', label: 'Everyday spending' },
  { value: 'fixed_monthly', label: 'Fixed monthly cost' },
  { value: 'fixed_yearly', label: 'Fixed yearly cost' },
] as const;

export type CategoryGroup = (typeof CATEGORY_GROUPS)[number]['value'];

export const CATEGORY_GROUP_VALUES = new Set<string>(CATEGORY_GROUPS.map((group) => group.value));

export function categoryGroupLabel(group: string): string {
  return CATEGORY_GROUPS.find((entry) => entry.value === group)?.label ?? group;
}
