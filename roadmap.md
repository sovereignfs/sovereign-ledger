# Roadmap — Ledger

Requirement IDs (`LDG-*`) are stable — never renumbered or reused. Full
requirement text, data model, and pillar boundaries live in the spec
(`SPEC.md`); **this doc is the source of truth for build order and status.**
Task 0 (scaffold) has shipped; every other task below is 📋 not started.

Status legend: 📋 not started · 🚧 in progress · ✅ shipped

The task order here **deviates from SPEC.md's milestone grouping in two
places**, both dependency-driven — flagged inline below (Task 7, Task 10).
SPEC.md's v0.1–v0.7 labels are kept as a reference column; they describe
*theme*, not *build order*.

Each task is sized to be one branch + one PR, per the platform's own "one
task = one branch = one PR" convention. Tasks are sequenced — assume each
depends on the previous unless its own "Depends on" says otherwise.

---

## MVP — Finance Tracker

Ships before Asset Overview starts. Every table below already carries its FX
columns (`fx_mode`/`fx_rate`/`base_amount` etc., per SPEC.md's data model) from
the scaffold task onward, defaulted to `fx_mode: 'base'`/`fx_rate: '1'` — this
avoids a schema migration later just to unlock Task 10–13's multi-currency
feature work. `fx_rate` is a `text` canonical-decimal-string column, not a
numeric/decimal SQL type — see "Platform gaps" below.

| # | Task | Spec ref | Depends on | Status |
| - | ---- | -------- | ---------- | ------ |
| 0 | Plugin scaffold — `manifest.json`, `icon.svg`, `package.json`, `tsconfig.json`, base `app/layout.tsx`, `db/schema.ts` with every MVP + post-MVP table (dormant columns included, plus the `last_posted_period`/`last_contributed_period` claim columns Tasks 8/9/10 need), migrations, dev/generate wiring, `CLAUDE.md` | — (chore) | — | ✅ |
| 1 | Settings — base currency, display currency, month-start day | v0.1 / LDG-01 | Task 0 | 📋 |
| 2 | Category tree — create/edit/archive categories + subcategories, groups (`dynamic`/`fixed_monthly`/`fixed_yearly`) | v0.1 / LDG-03 | Task 0 | 📋 |
| 3 | Budgets — default monthly amount per category, optional per-month override | v0.1 / LDG-04 | Task 2 | 📋 |
| 4 | Income sources & entries — create/edit/archive sources, record actual income per period | v0.1 / LDG-02, LDG-06 | Task 1 | 📋 |
| 5 | Expense logging — log a daily expense, edit/soft-delete | v0.1 / LDG-05, LDG-08 | Task 2 | 📋 |
| 6 | Monthly overview — income/expense/savings/balance totals, budget-vs-actual variance | v0.1 / LDG-07 | Tasks 3, 4, 5 | 📋 |
| 7 | **Jars core** — create, auto-contribute (interval-tick job + `last_contributed_period` claim, see "Platform gaps"), withdraw, adjust, progress-to-target. *Pulled forward from SPEC.md's v0.3* — see "Sequencing notes" | v0.3 / LDG-20, LDG-21, LDG-22, LDG-23, LDG-24 | Task 1 | 📋 |
| 8 | Recurring monthly expenses — define, auto-post each period (interval-tick job + `last_posted_period` claim, see "Platform gaps"), mark paid/skipped | v0.2 / LDG-10 (monthly), LDG-11, LDG-13 | Task 5 | 📋 |
| 9 | Recurring yearly expenses via jar — `amount / 12` monthly allocation, annual payment recorded as a jar withdrawal | v0.2 / LDG-10 (yearly), LDG-12 | Task 7, Task 8 | 📋 |
| 10 | **FX rates** — `ledger_fx_rates` live fetch (Frankfurter/exchangerate.host + CoinGecko, interval-tick job claiming today's `as_of` row — see "Platform gaps") + manual override. `rate` stored as a canonical decimal string (`text`), not a numeric type. *Foundational for 11–13* | v0.4 / LDG-31 | Task 0 | 📋 |
| 11 | Locked FX mode — one-time foreign items, rate captured at entry, base amount frozen | v0.4 / LDG-33 | Task 10, Task 5 | 📋 |
| 12 | Dynamic FX mode — recurring foreign items, revalued to base on each rollup | v0.4 / LDG-32 | Task 10, Task 8 | 📋 |
| 13 | Multi-currency rollups — every screen (dashboard, budgets, jars) displays correctly in base/display currency | v0.4 / LDG-30, LDG-34 | Tasks 6, 7, 11, 12 | 📋 |

**MVP done when:** a user can set up income/categories/budgets, log expenses,
run fixed/recurring costs automatically, contribute to and withdraw from
jars, and do all of it in more than one currency with correct FX handling.

---

## Post-MVP — Asset Overview

Not scheduled; not started until every MVP task above ships.

| # | Task | Spec ref | Depends on | Status |
| - | ---- | -------- | ---------- | ------ |
| 14 | Assets, snapshots, people — classes incl. `real_estate`/`vehicle`, institution/tags/notes metadata, manual monthly value entry | v0.5 / LDG-40, LDG-41, LDG-42, LDG-45, LDG-46, LDG-47 | Task 1 | 📋 |
| 15 | Net-worth view + trend — total assets − liabilities per month, converted via month-end FX, trend chart | v0.5 / LDG-43, LDG-44 | Task 14, Task 10 | 📋 |
| 16 | Jar-linked net worth — derived "Jars (set aside)" line, computed live from `ledger_jar_entries` | v0.6 / LDG-48 | Task 7, Task 15 | 📋 |

## Post-MVP — Cross-pillar

| # | Task | Spec ref | Depends on | Status |
| - | ---- | -------- | ---------- | ------ |
| 17 | Spending trends + budget-adjustment suggestions | v0.7 / LDG-50, LDG-51 | Task 6 | 📋 |
| 18 | CSV export — transactions, budgets, jars, net worth | v0.7 / LDG-52 | Task 6, Task 7, Task 15 | 📋 |

---

## Sequencing notes

- **Task 7 (jars) pulled forward from v0.3 to before Task 9.** SPEC.md groups
  jars under v0.3, after v0.2's fixed/recurring milestone — but LDG-12
  (yearly fixed cost funded via jar) literally cannot ship without a jar to
  fund it. Task 8 (recurring monthly, no jar dependency) still runs at its
  original v0.2 slot; only the yearly-via-jar half (Task 9) waits on jars.
- **Task 10 (FX rates) surfaced ahead of the rest of v0.4.** It's the one
  piece of multi-currency with no dependency on anything past the scaffold,
  so it can be built and verified against live providers independently of
  Tasks 11–13, which consume it.
- **Tasks 1, 2, and 10 have no dependency on each other** beyond the Task 0
  scaffold — candidates to parallelize if more than one contributor is
  available, unlike the rest of the queue which is a straight chain.
- Everything under "Post-MVP" is fully specified in SPEC.md so the schema is
  settled now, but genuinely not scheduled — don't start Task 14+ before
  Task 13 ships.

## Platform gaps (confirmed by code audit, Jul 2026)

Three findings from reading the actual platform code (not just RFC/roadmap
status) that shape how the tasks above get built. Full detail and citations
in SPEC.md's "Current platform state" and "Background jobs" sections.

1. **No cron, interval-only scheduler.** Manifest `schedules` is
   `{ intervalMinutes, entry }` only — no date/cron awareness, no persistence,
   no retries, a global kill switch. Tasks 7, 8, and 10 (jar auto-contribute,
   recurring auto-post, FX refresh) are built as frequent-tick handlers with a
   conditional-UPDATE claim column (`last_contributed_period`,
   `last_posted_period`, and an upsert-keyed `ledger_fx_rates` row
   respectively) — not literal daily/monthly jobs. Already reflected in each
   task's description above; don't design these as `if (isFirstOfMonth())`.
2. **No decimal/numeric column precedent anywhere in this codebase.** Task 10's
   `ledger_fx_rates.rate`, and every other `fx_rate` column across the schema,
   is a `text` canonical-decimal-string — never a real SQL `numeric`/`decimal`
   type (none exists in any plugin or the platform's own schema) and never a
   binary float. Parse with a decimal-safe helper, not `parseFloat`.
3. **The "open core" paid-feature plan is blocked, not just deferred.**
   `sdk.billing.getEntitlement()` is an unimplemented stub — calling it throws.
   Only whole-plugin route paywalling is real. This doesn't block any task
   above (no task here declares monetization), but it blocks designing the
   actual paid feature until one of the three options in SPEC.md's Open
   question 4 is chosen. Don't start any paid-feature task without revisiting
   that decision first.

## Open items carried from SPEC.md

See SPEC.md's own "Open questions" — FX provider/crypto-in-MVP confirmation
(affects Task 10), stock/metal manual-pricing confirmation (affects Task 14)
are unresolved but don't block starting Task 0. **Paid-tier design (Open
question 4) is now flagged as blocked-as-specced, not just deferred** — see
"Platform gaps" above; it still doesn't block any MVP task, but don't start
post-MVP monetization work without resolving it first.

## Changelog

| Version | Date     | Change |
| ------- | -------- | ------ |
| 0.3     | Jul 2026 | **Task 0 (plugin scaffold) shipped.** `manifest.json`, `icon.svg`, `package.json`, `tsconfig.json`, `db/schema.ts`/`db/schema.postgres.ts` (all 13 MVP + post-MVP tables, incl. `last_posted_period`/`last_contributed_period` claim columns and `ledger_fx_rates`' unique index), hand-authored SQLite migration + drizzle-kit-generated Postgres migration, minimal `app/layout.tsx`/`app/page.tsx`, `CLAUDE.md`, `README.md`, `LICENSE` (AGPLv3). Verified: `tsc --noEmit` clean, ESLint SDK-boundary clean, manifest validates against `packages/manifest`'s schema, `pnpm generate` composes the route correctly, and `/ledger` renders in a live dev server with no console errors. |
| 0.2     | Jul 2026 | Added "Platform gaps" section from a code audit: scheduler is interval-only (no cron/persistence) — Tasks 7/8/10 updated to specify their claim-column pattern explicitly; no decimal/numeric column precedent exists anywhere in the codebase — `fx_rate`/`rate` locked to `text` canonical-decimal-string, Task 0 and Task 10 updated; "open core" monetization confirmed blocked (`sdk.billing.getEntitlement()` unimplemented), not merely deferred. |
| 0.1     | Jul 2026 | Initial roadmap — SPEC.md's milestone-grouped requirements broken into a dependency-ordered task queue. Jars (originally v0.3) pulled forward ahead of yearly recurring (v0.2); FX rates (v0.4) surfaced as its own early task. |
