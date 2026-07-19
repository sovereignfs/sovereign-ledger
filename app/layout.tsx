import type { ReactNode } from 'react';
import { registerPortabilityHandlers } from './_lib/portability';

/**
 * Base shell for the Ledger plugin. Deliberately minimal at this scaffold
 * stage (roadmap.md Task 0) — no sidebar/nav chrome yet, since no feature
 * screens exist to navigate between. Grows as Finance Tracker's screens
 * (dashboard, expenses, budget, jars, settings) land in later tasks.
 */
export default async function LedgerLayout({ children }: { children: ReactNode }) {
  // In-process and reset on restart — the platform SDK requires
  // re-registering from a request-scoped plugin route, so this runs on
  // every request. Best-effort: a registration failure must not block the
  // plugin's own UI (matches sovereign-tasks' layout.tsx).
  try {
    await registerPortabilityHandlers();
  } catch {
    // Portability is a best-effort platform integration.
  }

  return children;
}
