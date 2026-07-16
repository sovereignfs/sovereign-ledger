import type { ReactNode } from 'react';

/**
 * Base shell for the Ledger plugin. Deliberately minimal at this scaffold
 * stage (roadmap.md Task 0) — no sidebar/nav chrome yet, since no feature
 * screens exist to navigate between. Grows as Finance Tracker's screens
 * (dashboard, expenses, budget, jars, settings) land in later tasks.
 */
export default function LedgerLayout({ children }: { children: ReactNode }) {
  return children;
}
