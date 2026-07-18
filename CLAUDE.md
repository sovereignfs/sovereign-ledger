# CLAUDE.md — sovereign-ledger

Guidance for Claude Code working in this plugin repository.

## What this is

**Ledger** — a budget-first personal finance tracker with two pillars: Finance
Tracker (MVP — budget, expenses, fixed/recurring costs, savings jars,
multi-currency) and Asset Overview (post-MVP — net worth, assets, people). A
`type: sovereign` Sovereign plugin maintained in its own repository
(`sovereign-ledger`), open source (AGPLv3), open-core (paid feature(s) TBD).

Spec: [SPEC.md](SPEC.md) · Build order: [roadmap.md](roadmap.md)

## Identity

| Property     | Value                          |
| ------------- | ------------------------------ |
| Plugin ID     | `fs.sovereign.ledger`          |
| Route prefix  | `/ledger`                      |
| Database      | `shared` — tables live in the platform DB, slug-prefixed |
| Permissions   | `auth:session`, `db:readWrite`, `data:provide`, `data:export`, `data:import`, `activity:write`, `notifications:send` |
| Min platform  | `0.26.4`                       |
| Table prefix  | `ledger_`                      |

## SDK-only rule

**Never import from `@sovereignfs/db` directly.** All database access goes
through `sdk.db`. This is enforced by the platform's ESLint SDK boundary rule
and is the defining constraint of an externally-maintained plugin.

```ts
// ✅ correct
import { getSdk } from '@sovereignfs/sdk';
const sdk = getSdk();
const db = await sdk.db();

// ❌ wrong — breaks the plugin/platform boundary
import { getPlatformDb } from '@sovereignfs/db';
```

## tenant_id scoping

Every query that touches user data **must** filter by both `tenant_id` and
the current user's `id`. There is no exception — Ledger has no sharing model,
every table is strictly owner-scoped.

```ts
const transactions = await db
  .select()
  .from(ledgerTransactions)
  .where(and(eq(ledgerTransactions.tenantId, tenantId), eq(ledgerTransactions.userId, userId)));
```

**One deliberate exception:** `ledger_fx_rates` carries no `tenant_id`/`user_id`
at all — see its own schema comment. It's a shared instance-level cache of
public market data (currency-pair rates), not personal data, so caching it
once per instance rather than once per tenant is correct, not a scoping bug.

## Money and FX storage

- **Money** (`amount`, `expected_amount`, `base_amount`, `value`, `base_value`,
  `monthly_contribution`, `target_amount`) is `integer`, minor units — never a
  float.
- **`fx_rate`/`rate` columns are `text` holding a canonical decimal string**
  (e.g. `"1.0842"`), never a real numeric/decimal SQL type (none exists
  dialect-agnostically anywhere in this codebase — confirmed by a Jul 2026
  code audit, see SPEC.md's "Current platform state") and never a binary
  float. Parse with a decimal-safe helper, never `parseFloat` alone, when
  computing `base_amount = round(amount * rate)`.

## Table prefix

All plugin tables are prefixed `ledger_`:

- `ledger_settings`, `ledger_income_sources`, `ledger_income_entries`
- `ledger_categories`, `ledger_budgets`, `ledger_transactions`
- `ledger_recurring`, `ledger_jars`, `ledger_jar_entries`
- `ledger_fx_rates`
- `ledger_assets`, `ledger_asset_snapshots`, `ledger_people` (post-MVP)

Schema lives in `app/_db/schema.ts` (SQLite-core — the one application code
queries against, regardless of the platform's actual configured dialect;
lives under `app/` because only that tree is composed into the runtime's
route table, not plugin-root `db/`) and `db/schema.postgres.ts` (Postgres-core
mirror, migration-generation only — never imported by application code).
`db/schema.ts` is a thin `export * from '../app/_db/schema'` re-export for
drizzle-kit and repo-root tooling. See `app/_db/schema.ts`'s own header
comment for the full column-type conventions (IDs, timestamps, booleans).

## Background jobs (scheduler constraints)

The platform scheduler (RFC 0046) has **no cron concept** — a manifest
`schedules` entry is only `{ intervalMinutes, entry }`, ticked by an in-memory
interval loop with no persistence, no retries, no leader election across
replicas, and a global `SOVEREIGN_SCHEDULER_DISABLED` kill switch. None of
this plugin's periodic jobs (FX rate refresh, recurring auto-post, jar
auto-contribute) can be a literal "runs once a day/month" job — each is a
frequent-tick handler that checks, on every tick, whether the real-world
condition is already satisfied, using a conditional-UPDATE claim column so
restarts and multi-replica deployments can't double-fire:

| Job | Claim column | Requirement |
| --- | --- | --- |
| FX rate refresh | `ledger_fx_rates` upsert keyed on `(base, quote, as_of, source)` | LDG-31 |
| Recurring monthly auto-post | `ledger_recurring.last_posted_period` | LDG-11 |
| Jar monthly auto-contribution | `ledger_jars.last_contributed_period` | LDG-21 |

Follow `sovereign-tasks`' `app/_jobs/due-reminders.ts` as the reference
implementation of this idiom. Full detail: SPEC.md's "Background jobs" section.

## Monetization

**Open core is the intent, but the mechanism isn't ready.**
`sdk.billing.getEntitlement()`/`requireEntitlement()` are unimplemented stubs
(throw `NotImplementedError`) — only whole-`routePrefix` paywalling is real
(RFC 0003 Phase 1). Don't design a paid feature around an in-code entitlement
check until this changes, or until one of SPEC.md's Open question 4
alternatives is chosen. No `monetization` block in the manifest yet.

## Milestone scope (see roadmap.md for full detail)

Requirement IDs (`LDG-*`) are stable — never renumber or reuse one.

| Task | Description | Status |
| --- | --- | --- |
| 0 | Plugin scaffold (manifest, schema, migrations, base app shell) | ✅ shipped |
| 1 | Settings — base currency, display currency, month-start day | ✅ shipped |
| 2 | Category tree — create/edit/archive categories and subcategories | ✅ shipped |
| 3 | Budgets — default monthly amount per category, per-month overrides | ✅ shipped |
| 4 | Income sources & entries — create/edit/archive sources, record income | ✅ shipped |
| 5 | Expense logging — log a daily expense, edit/soft-delete | ✅ shipped |
| 6 | Monthly overview — totals, budget-vs-actual variance | ✅ shipped |
| 7 | Jars core | 📋 not started |
| 8–9 | Fixed and recurring | 📋 not started |
| 10–13 | Multi-currency | 📋 not started |
| 14–16 | Asset Overview (post-MVP) | 📋 not started |
| 17–18 | Insights and export (post-MVP, cross-pillar) | 📋 not started |

**Do not start Task 14+ (Asset Overview) before Task 13 ships** — MVP is
Finance Tracker only.

## UI rules

- Consume `@sovereignfs/ui` components and `--sv-*` tokens exclusively.
- Never hardcode colours, spacing, or radii — always reference tokens.
- **DS-first: this plugin is a consumer.** Don't hand-roll reusable UI
  primitives here (interaction hooks, overlays, pickers) — add them to
  `@sovereignfs/ui` in the platform repo and consume from there, following
  `sovereign-tasks`'/`sovereign-shopper`'s precedent.
- No dedicated finance icon exists yet in `@sovereignfs/ui`'s curated `Icon`
  set (currently grocery/generic icons only) — `app/page.tsx`'s placeholder
  `EmptyState` deliberately omits the optional `icon` prop rather than
  misusing an unrelated icon. Add a real one to `@sovereignfs/ui` when a
  screen actually needs it, not preemptively.

## Versioning

This plugin follows its own semver, independent of the platform version:

- `fix/` → patch (0.0.x)
- `feat/` → minor (0.x.0)
- Breaking change → major (x.0.0)

Current version: **0.7.0**

## Running locally

The plugin is mounted into the Sovereign platform during development. From
the platform monorepo root:

```bash
pnpm dev   # starts runtime on :3000; plugin routes are available at /ledger
```

After changing the database schema (`app/_db/schema.ts`), hand-author a matching
migration under `migrations/sqlite/` (no generate step for SQLite — append an
entry to `migrations/sqlite/meta/_journal.json`), then regenerate the
Postgres mirror:

```bash
pnpm db:generate:pg
```

When porting to the standalone `sovereign-ledger` repo, the plugin is
installed via `sv plugin add` and the platform hot-reloads it.

## Open questions (from SPEC.md)

1. FX providers (Frankfurter/exchangerate.host + CoinGecko) — confirm; crypto
   in MVP or deferred?
2. Stock/metal prices — manual snapshot in Asset Overview; live pricing later?
3. Paid tier design — blocked as specced, see "Monetization" above.
