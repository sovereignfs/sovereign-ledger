# Ledger

**Version:** 0.3\
**Date:** July 2026\
**Author:** kasunben\
**Purpose:** Canonical specification for the Ledger plugin — the single source of truth for its manifest, access model, data model, and build plan.\
**Status:** Planning

---

Ledger is a personal finance plugin built around two pillars:

1. **Finance Tracker** — a **budget-first** expense/income/jars/multi-currency
   tracker. Validated for several years in a Google Sheets workbook
   (multi-currency budget + net-worth tracker, base EUR, monthly cadence with
   day-of-month entry). This pillar is **the MVP** — it ships first, on its own.
2. **Asset Overview** — manual monthly snapshots of assets, liabilities, and
   people (receivables/payables), rolled up into a net-worth view, plus a
   derived line for money set aside in Finance Tracker's savings jars.
   **Post-MVP** — scoped and specified here, but not built until Finance
   Tracker has shipped.

Web access is always via the user's Sovereign instance. A standalone app may
follow in a later phase, built on the same core — explicitly deferred for now.

Both pillars ship **free** for MVP. Open-core paid features are still the
intent, but **the specific mechanism Ledger needs isn't built yet** — see
"Current platform state" and Open question 4. `sdk.billing.getEntitlement()`/
`requireEntitlement()` are unimplemented stubs today (`packages/sdk/src/unimplemented.ts`,
confirmed by code audit, Jul 2026): calling either throws `NotImplementedError`,
with zero real call sites anywhere in the runtime. What *is* real (RFC 0003
Phase 1) is coarser than "open core" needs: the middleware can paywall a
plugin's **entire `routePrefix`**, all-or-nothing — there's no way to gate one
or two features while the rest of the plugin stays free. Ledger declares no
`monetization` block for now; the paid-feature design has to change shape
(or wait) before it can ship as originally envisioned.

## What makes Finance Tracker different

Most trackers are **transaction-first** (log spending, categorise later).
Finance Tracker is **budget-first**:

1. You declare **income** (fixed + dynamic) and a **category tree**, then set a
   **budget per (sub)category**.
2. You log **daily expenses** against those allocations and watch the variance.
3. **Fixed costs** — monthly and yearly — are unified as monthly allocations: a
   yearly bill is treated as `amount / 12` set aside each month, funded by a
   **savings jar**, so the monthly picture reflects true cost.
4. Each month you review **actual vs. budget** and adjust allocations to reality.
5. **Savings jars** are first-class: monthly contributions accumulate; making the
   real payment records a withdrawal and draws the jar down. Users create custom
   jars for any future outlay.
6. **Multi-currency** throughout, with two FX modes (below).

Asset Overview complements this with net worth: **manual monthly snapshots**
of assets and liabilities, plus jar balances rolled in as money already set
aside.

## Current platform state (July 2026)

Confirmed by a code audit (not just doc/RFC status), Jul 2026:

Every SDK surface Ledger needs for its MVP scope is already stable:

- `sdk.db`, `sdk.data` (RFC 0002), `sdk.activity` (RFC 0005),
  `sdk.notifications` (RFC 0015/0016), `sdk.env` (RFC 0018), and `sdk.secrets`
  (RFC 0043, plugin secret vault) are all shipped.
- FX provider configuration can use either plugin-scoped env vars
  (instance-level keys, `sdk.env`) or, once per-user provider credentials are
  wanted, the plugin secret vault (`sdk.secrets`) — no longer blocked on an
  unshipped RFC.
- Ledger should participate in export/import and user deletion via the
  account-level data portability flow (RFC 0007/0033), the same pattern
  `sovereign-tasks` uses (`app/_lib/portability.ts`). Fully generic — proven
  with three existing external plugins, no platform-side change needed for a
  fourth.
- Read-only contracts can expose budget summaries, transaction rollups, savings
  jars, and net-worth snapshots to approved consumers (RFC 0002). Two real
  limitations: contract *versioning* is a manifest-level label only — the
  resolver registry dispatches purely by contract name, never by version, so a
  future breaking v2 is Ledger's own problem to solve — and the resolver
  registry is in-process/per-replica (register from `app/layout.tsx` on every
  request, like `sovereign-plainwrite` does, not just at boot).
- Any assistant-created transaction, budget change, or jar adjustment should
  still wait for confirmed plugin tool contracts (RFC 0047) — **not yet
  shipped**.
- **Plugin monetization is not what "shipped" suggests.** RFC 0003 Phase 1 is
  marked done in `docs/roadmap.md`, but that only means the manifest schema
  and whole-plugin route paywalling are real (and dev-testable today via
  manual license-token grants, no payment processor needed). The **in-code
  entitlement check** (`sdk.billing.getEntitlement()`) that an "open core"
  design requires is unimplemented — see the intro section above and Open
  question 4.
- **The plugin scheduler (RFC 0046) has no cron concept** — manifest
  `schedules` only supports `intervalMinutes`, ticked by a single in-memory
  `setInterval` with no persistence, no retries, and a global
  `SOVEREIGN_SCHEDULER_DISABLED` kill switch. "Daily FX refresh" and "monthly
  auto-post" (LDG-11, LDG-21, LDG-31) must be built as frequent-tick handlers
  that check "has this already happened for today/this period" via a
  conditional-UPDATE claim column — see "Background jobs" below.
- **No existing plugin stores a true high-precision decimal column** across
  both SQLite and Postgres. Every plugin's money is integer minor units; the
  one existing fractional-quantity precedent (`sovereign-shopper`) uses a
  canonical decimal *string* in a `text` column specifically to avoid float
  drift, never a real `NUMERIC`/`DECIMAL` type. Ledger's `fx_rate`/`rate`
  columns adopt that same pattern — see "Data model" and "Currency and FX
  model" below.

## Contents

- [Identity and manifest](#identity-and-manifest)
- [Pillars and MVP scope](#pillars-and-mvp-scope)
- [Access control](#access-control)
- [Functional requirements](#functional-requirements)
- [Directory structure](#directory-structure)
- [Data model](#data-model)
- [Currency and FX model](#currency-and-fx-model)
- [Net-worth model](#net-worth-model)
- [Monthly cycle and budget tracking](#monthly-cycle-and-budget-tracking)
- [Background jobs](#background-jobs)
- [SDK dependencies](#sdk-dependencies)
- [Platform capability cross-reference](#platform-capability-cross-reference)
- [UI](#ui)
- [Build plan](#build-plan)
- [Open questions](#open-questions)
- [Changelog](#changelog)

---

## Identity and manifest

| Property                           | Value                                          |
| ----------------------------------- | ---------------------------------------------- |
| `id`                                | `fs.sovereign.ledger`                          |
| `name`                              | `Ledger`                                       |
| `type`                              | `sovereign`                                    |
| `runtime`                           | `native`                                       |
| `routePrefix`                       | `/ledger`                                      |
| `shell`                             | `default`                                      |
| `adminOnly`                         | omitted (`false`)                              |
| `icon`                              | `icon.svg`                                     |
| `permissions`                       | `auth:session`, `db:readWrite`, `data:provide`, `data:export`, `data:import`, `activity:write`, `notifications:send` |
| `repository`                       | `https://github.com/sovereignfs/sovereign-ledger` (public) |
| `compatibility.minPlatformVersion` | `0.26.4`                                       |

`type: "sovereign"` — first-party/trusted, maintained outside the core
monorepo, same model as `sovereign-tasks`: public repo, AGPLv3, eligible for
submission to the public plugin registry (`registry/plugins.json`) once
stable. Open core is still the intent, but the in-code entitlement gate this
requires isn't implemented platform-side yet — see "Current platform state"
and Open question 4 before designing the paid feature(s).

Proposed `manifest.json`:

```json
{
  "schemaVersion": 1,
  "id": "fs.sovereign.ledger",
  "name": "Ledger",
  "version": "0.1.0",
  "description": "Budget-first personal finance tracker with savings jars and multi-currency, plus a net-worth asset overview.",
  "type": "sovereign",
  "runtime": "native",
  "routePrefix": "/ledger",
  "shell": "default",
  "icon": "icon.svg",
  "permissions": [
    "auth:session",
    "db:readWrite",
    "data:provide",
    "data:export",
    "data:import",
    "activity:write",
    "notifications:send"
  ],
  "repository": "https://github.com/sovereignfs/sovereign-ledger",
  "compatibility": { "minPlatformVersion": "0.26.4" }
}
```

> Manifest must satisfy the `.strict()` schema in `packages/manifest/src/schema.ts`.
> `repository` is required for non-platform types.
> No `monetization` block yet — see "Current platform state" above.

## Pillars and MVP scope

| Pillar | Status | Covers |
| --- | --- | --- |
| **Finance Tracker** | **MVP — build first** | Settings, income, categories, budgets, expenses, fixed/recurring costs, savings jars, multi-currency. Milestones v0.1–v0.4. |
| **Asset Overview** | Post-MVP | Assets/liabilities, people (receivables/payables), net worth, jar-linked "set aside" line. Milestones v0.5–v0.6. |
| **Cross-pillar** | Post-MVP | Spending insights and CSV export spanning both pillars. Milestone v0.7. |

MVP is Finance Tracker only. Asset Overview and the cross-pillar milestone are
fully specified below (so the data model and pillar boundary are decided up
front) but are not scheduled for the initial build.

## Access control

Available to authenticated users who can launch installed plugins. No admin gate.
All data is **owner-scoped**: a user sees only their own finances. Every
user-scoped table carries `tenant_id` (platform convention) and `user_id`.

## Functional requirements

Requirements are versioned to their milestone. IDs are stable — never renumber or
reuse an `LDG-*` id.

### Pillar 1 — Finance Tracker (MVP)

#### v0.1 — Foundations

| ID     | Requirement |
| ------ | ----------- |
| LDG-01 | Set base currency, month-start day, and display currency. |
| LDG-02 | Create/edit/archive income sources: name, kind (`fixed`/`dynamic`), expected amount, currency, cadence (`monthly`/`yearly`/`adhoc`). |
| LDG-03 | Create/edit/archive a category tree: top-level categories and subcategories, each in a group (`dynamic`/`fixed_monthly`/`fixed_yearly`). |
| LDG-04 | Set a budget per category/subcategory: a default monthly amount, with optional per-month overrides. |
| LDG-05 | Log a daily expense under a subcategory: date, amount, note. Amounts stored as integer minor units. |
| LDG-06 | Record actual income against a source for a period. |
| LDG-07 | Monthly overview: total income, total expenses by group, savings, balance, and budget-vs-actual variance per category. |
| LDG-08 | Edit/delete a logged expense; soft-delete preferred for auditability. |

#### v0.2 — Fixed and recurring

| ID     | Requirement |
| ------ | ----------- |
| LDG-10 | Define recurring fixed expenses (monthly or yearly): name, category, amount, currency, schedule. |
| LDG-11 | Auto-post recurring monthly expenses each period without manual entry. |
| LDG-12 | Model yearly fixed expenses as `amount / 12` monthly allocations funded via a jar; the actual annual payment is recorded against the jar. |
| LDG-13 | Mark a recurring item paid/skipped for a given period; reflect in actuals. |

#### v0.3 — Savings jars

| ID     | Requirement |
| ------ | ----------- |
| LDG-20 | Create custom jars: name, monthly contribution, optional target, optional link to a recurring payment. |
| LDG-21 | Auto-contribute the monthly amount to each jar each period. |
| LDG-22 | Record a payment from a jar (withdrawal); reduce the jar balance and optionally create the matching expense transaction. |
| LDG-23 | Show jar balances and progress toward target. |
| LDG-24 | Manual jar adjustment (top-up/correction) with note. |

#### v0.4 — Multi-currency

| ID     | Requirement |
| ------ | ----------- |
| LDG-30 | Record any monetary item in a currency other than the base currency. |
| LDG-31 | Live FX rates auto-fetched (fiat + crypto), cached, with manual override. |
| LDG-32 | **Dynamic** FX mode for recurring foreign items: revalue to base at the current rate on each rollup. |
| LDG-33 | **Locked** FX mode for one-time foreign items: capture the rate at entry; base amount frozen. |
| LDG-34 | All rollups (income, expenses, budgets, jars) display in base/display currency. |

### Pillar 2 — Asset Overview (post-MVP)

#### v0.5 — Assets and net worth

| ID     | Requirement |
| ------ | ----------- |
| LDG-40 | Define assets/liabilities: name, class, currency. Class enum: `banking` \| `stock` \| `crypto` \| `metal` \| `deposit` \| `receivable` \| `loan` \| `real_estate` \| `vehicle` \| `other`. |
| LDG-41 | Enter a **manual monthly value** per asset/liability (a snapshot). |
| LDG-42 | Track people/debts (receivables and payables) — the spreadsheet's "People" block. |
| LDG-43 | Net-worth view: total assets − liabilities per month, converted to base via the month's FX. |
| LDG-44 | Net-worth trend across months. |
| LDG-45 | Per-asset metadata: optional institution/broker name, free-form tags, and notes. |
| LDG-46 | `real_estate` class — manual snapshot only (purchase price and current estimate are both just entries in the value history; no automated valuation). |
| LDG-47 | `vehicle` class — manual snapshot only, same model as `real_estate`. |

#### v0.6 — Jar-linked net worth

| ID     | Requirement |
| ------ | ----------- |
| LDG-48 | Net worth includes a derived **"Jars (set aside)"** line: the sum of all active Finance Tracker jar balances at the snapshot period's end, converted to base. Computed at read time from `ledger_jar_entries` (same derivation as jar balances in Finance Tracker) — not a stored snapshot row, so it always reflects the live jar state rather than a point-in-time entry a user could forget to update. |

### Cross-pillar (post-MVP)

#### v0.7 — Insights and export

| ID     | Requirement |
| ------ | ----------- |
| LDG-50 | Spending trends per category across months (Finance Tracker data). |
| LDG-51 | Budget-adjustment suggestions based on actual patterns (Finance Tracker data). |
| LDG-52 | CSV export of transactions, budgets, jars, and net worth (spans both pillars). |

## Directory structure

```
sovereign-ledger/
├── manifest.json
├── icon.svg
├── app/                       # composed into runtime/(platform)/(plugins)/ledger
│   ├── page.tsx               # Finance Tracker: monthly overview dashboard
│   ├── expenses/              # Finance Tracker: daily entry + list
│   ├── budget/                # Finance Tracker: category tree + allocations
│   ├── jars/                  # Finance Tracker: jars
│   ├── networth/              # Asset Overview (post-MVP)
│   ├── settings/
│   └── api/                   # server routes (FX fetch, CRUD)
├── components/                # finance-specific UI (kept in-plugin)
├── db/                        # ledger_* Drizzle schema + queries
└── lib/                       # money/FX helpers, period logic
```

## Data model

All tables are slug-prefixed `ledger_*` in the shared schema (renamed from the
earlier `ledgerly_*` draft to match the plugin rename). Money is **integer
minor units** (never float). Currency is **ISO 4217** (or a crypto symbol, e.g.
`BTC`). Every user-scoped table has `tenant_id` and `user_id`.

### Finance Tracker tables (MVP)

#### `ledger_settings` (one row per user)

| Column             | Type    | Notes                                  |
| ------------------ | ------- | ---------------------------------------- |
| `user_id`          | string  | PK.                                    |
| `tenant_id`        | string  |                                        |
| `base_currency`    | string  | ISO 4217. All base amounts are in this. |
| `display_currency` | string  | Optional; defaults to base.            |
| `month_start_day`  | integer | 1–28; defines the monthly window.      |

#### `ledger_income_sources`

| Column            | Type    | Notes                                |
| ----------------- | ------- | ------------------------------------ |
| `id`              | string  | PK.                                  |
| `tenant_id`/`user_id` | string |                                  |
| `name`            | string  |                                      |
| `kind`            | enum    | `fixed` \| `dynamic`                 |
| `expected_amount` | integer | Minor units.                         |
| `currency`        | string  | ISO 4217.                            |
| `cadence`         | enum    | `monthly` \| `yearly` \| `adhoc`     |
| `active`          | boolean |                                      |
| `sort_order`      | integer |                                      |

#### `ledger_income_entries`

| Column        | Type    | Notes                                  |
| ------------- | ------- | ----------------------------------------- |
| `id`          | string  | PK.                                    |
| `source_id`   | string  | FK → income_sources.                   |
| `period`      | string  | `YYYY-MM`.                             |
| `amount`      | integer | Minor units, in `currency`.            |
| `currency`    | string  | ISO 4217.                              |
| `fx_rate`     | text    | Canonical decimal string (see "Currency and FX model"); `"1"` if base. |
| `base_amount` | integer | Minor units in base currency.          |
| `note`        | string  | Optional.                              |

#### `ledger_categories`

| Column       | Type    | Notes                                                      |
| ------------ | ------- | ------------------------------------------------------------ |
| `id`         | string  | PK.                                                        |
| `parent_id`  | string  | Null for top-level; else FK → categories (subcategory).    |
| `name`       | string  |                                                            |
| `group`      | enum    | `dynamic` \| `fixed_monthly` \| `fixed_yearly`             |
| `sort_order` | integer |                                                            |
| `archived`   | boolean |                                                            |

#### `ledger_budgets`

| Column        | Type    | Notes                                                |
| ------------- | ------- | -------------------------------------------------------- |
| `id`          | string  | PK.                                                  |
| `category_id` | string  | FK → categories.                                     |
| `period`      | string  | `YYYY-MM`, or null for the **default** monthly budget. |
| `amount`      | integer | Minor units.                                         |
| `currency`    | string  | ISO 4217 (normally base).                            |

#### `ledger_transactions` (expenses)

| Column          | Type    | Notes                                                       |
| --------------- | ------- | ----------------------------------------------------------------- |
| `id`            | string  | PK.                                                         |
| `category_id`   | string  | FK → categories (a subcategory).                            |
| `date`          | date    |                                                             |
| `amount`        | integer | Minor units, in `currency`.                                 |
| `currency`      | string  | ISO 4217 / crypto.                                          |
| `fx_mode`       | enum    | `base` \| `locked` \| `dynamic`                             |
| `fx_rate`       | text    | Canonical decimal string; locked rate when `fx_mode = locked`, null when `dynamic`. |
| `base_amount`   | integer | Minor units in base; recomputed each rollup when `dynamic`. |
| `note`          | string  | Optional.                                                   |
| `source`        | enum    | `manual` \| `recurring` \| `imported`                       |
| `recurring_id`  | string  | FK → recurring (when auto-posted).                          |
| `jar_id`        | string  | FK → jars (when this expense is funded by a jar withdrawal). |
| `deleted_at`    | date    | Soft delete.                                                |

#### `ledger_recurring`

| Column        | Type    | Notes                                              |
| ------------- | ------- | ---------------------------------------------------- |
| `id`          | string  | PK.                                                |
| `category_id` | string  | FK → categories (fixed group).                     |
| `name`        | string  |                                                    |
| `amount`      | integer | Minor units.                                       |
| `currency`    | string  | ISO 4217.                                          |
| `cadence`     | enum    | `monthly` \| `yearly`                              |
| `fx_mode`     | enum    | `dynamic` \| `locked`                              |
| `schedule`    | json    | Day-of-month / month-of-year.                      |
| `jar_id`      | string  | FK → jars (yearly funding jar).                    |
| `start_date`  | date    |                                                    |
| `end_date`    | date    | Optional.                                          |
| `active`      | boolean |                                                    |
| `last_posted_period` | string? | `YYYY-MM`, nullable. Claim column for the auto-post job — see "Background jobs". |

#### `ledger_jars` + `ledger_jar_entries`

`jars`: `id`, `name`, `monthly_contribution` (minor), `currency`, `target_amount`
(nullable), `linked_recurring_id` (nullable), `active`, `sort_order`,
`last_contributed_period` (`YYYY-MM`, nullable — claim column for the
auto-contribute job, see "Background jobs").

`jar_entries`: `id`, `jar_id`, `period`/`date`, `type`
(`contribution` | `withdrawal` | `adjustment`), `amount` (minor), `currency`,
`fx_rate` (text, canonical decimal string), `base_amount`, `note`,
`transaction_id` (nullable — links a withdrawal
to the expense it funded). **Jar balance is derived** = Σ contributions +
adjustments − withdrawals. Consumed by both Finance Tracker (jar screens) and,
post-MVP, Asset Overview's LDG-48 net-worth line.

#### `ledger_fx_rates`

| Column       | Type    | Notes                                       |
| ------------ | ------- | ------------------------------------------- |
| `id`         | string  | PK.                                         |
| `base`       | string  | Quote currency (e.g. `USD`).                |
| `quote`      | string  | Against which (usually the user base).      |
| `rate`       | text    | Canonical decimal string; see below.         |
| `as_of`      | date    | Day the rate applies to.                    |
| `source`     | enum    | `api` \| `manual`                           |
| `fetched_at` | datetime |                                            |

> **Resolved (Jul 2026 code audit):** `rate` is **not** minor units and is
> **not** a real SQL `NUMERIC`/`DECIMAL` column — a search of every plugin and
> the platform's own schema found zero uses of `numeric()`/`decimal()` in
> either dialect, so there's no existing precedent to lean on. `rate` (and
> every other `fx_rate` column in this data model) is a **`text` column
> holding a canonical decimal string**, parsed with a decimal-safe helper
> (never `parseFloat`) — the same pattern `sovereign-shopper` already
> established for its own fractional (non-money) quantities, and the only
> approach that's genuinely identical across SQLite (no native arbitrary-
> precision numeric type) and Postgres. `base_amount = round(amount *
> parseDecimal(rate))` always goes through that helper, never native
> arithmetic on the stored string.

### Asset Overview tables (post-MVP)

#### `ledger_assets` + `ledger_asset_snapshots`

`assets`: `id`, `name`, `class`
(`banking` | `stock` | `crypto` | `metal` | `deposit` | `receivable` | `loan` |
`real_estate` | `vehicle` | `other` — `real_estate` and `vehicle` are new
classes added for this pillar), `currency`, `person_id` (nullable, FK →
people), `institution` (nullable string — bank/broker name), `tags` (nullable
json array of strings), `notes` (nullable text), `active`, `sort_order`.

`asset_snapshots`: `id`, `asset_id`, `period` (`YYYY-MM`), `value` (minor, signed;
negative/`loan` = liability), `currency`, `fx_rate` (text, canonical decimal
string), `base_value`, `note`. **Manual monthly entry.**

#### `ledger_people`

`id`, `name`, `note`. Receivables/payables ("People" block) are modeled as assets
of class `receivable`/`loan` carrying `person_id`.

## Currency and FX model

- **Base currency** per user; all `base_amount`/`base_value` columns are in it.
- Each monetary record carries `amount` + `currency`; `base_amount` is derived.
- **FX modes:**
  - `base` — record is in base currency; rate 1.
  - `locked` — one-time foreign item; `fx_rate` captured at entry; `base_amount`
    frozen (does not move when rates change).
  - `dynamic` — recurring foreign item; `base_amount` recomputed from the latest
    `ledger_fx_rates` on each rollup (reflects current value).
- **Live FX (LDG-31):** a server-side route refreshes `ledger_fx_rates` daily —
  fiat via Frankfurter / exchangerate.host, crypto via CoinGecko — upserting
  `source = api` rows. Manual override inserts `source = manual` rows that win for
  their `as_of` day. **The "daily" cadence is not literal** — see "Background
  jobs" below for how this actually gets triggered given the platform
  scheduler's constraints.
- **Net-worth snapshots** convert each line via the month's (end-of-month) rate.
- **All `fx_rate`/`rate` columns are canonical decimal strings in a `text`
  column** (never a real numeric/decimal SQL type, never a binary float) —
  see the `ledger_fx_rates` table note above for why.

## Background jobs

The platform scheduler (RFC 0046) has **no cron concept** — a manifest
`schedules` entry is only `{ intervalMinutes, entry }`, ticked by a single
in-memory interval loop with no persistence, no retries, and no leader
election across replicas. There is also a global `SOVEREIGN_SCHEDULER_DISABLED`
kill switch an operator could set, which would silently stop every job below
with no independent fallback. None of Ledger's three periodic needs can be a
literal "runs once a day" or "runs on the 1st of the month" job — each is a
frequent-tick handler (e.g. `intervalMinutes: 60`) that checks, on every tick,
whether the real-world condition has already been satisfied, using a
conditional-UPDATE claim column so restarts and multi-replica deployments
can't double-fire. This is the exact idiom `sovereign-tasks`'s
`app/_jobs/due-reminders.ts` already uses for its once-per-day digest.

| Job | Requirement | Claim mechanism |
| --- | --- | --- |
| FX rate refresh | LDG-31 | Skip if `ledger_fx_rates` already has an `source = 'api'` row for today's `as_of`; claim via an upsert keyed on `(base, quote, as_of, source)`. |
| Recurring monthly auto-post | LDG-11 | A `last_posted_period` column on `ledger_recurring`, advanced via conditional UPDATE (`WHERE last_posted_period < :thisPeriod`) before inserting the transaction. |
| Jar monthly auto-contribution | LDG-21 | A `last_contributed_period` column on `ledger_jars`, same conditional-UPDATE-before-insert pattern. |

Design these claim columns into the schema from the start (Task 0's scaffold),
not bolted on after a double-posting bug surfaces.

## Net-worth model

Net worth for a month = Σ `base_value` of all asset snapshots − Σ liabilities
(loans/payables; negative-valued lines) + the derived jar "set aside" line
(LDG-48). Asset/liability values are **manually entered** per asset per month
(per the "live FX, manual assets" decision); only the FX conversion is
automatic. The jar line is the one exception — it's computed live from
Finance Tracker's `ledger_jar_entries`, not entered by hand. People
receivables add; payables subtract. The trend view plots monthly net worth
over time.

## Monthly cycle and budget tracking

- A **period** is a calendar month (offset by `month_start_day`).
- **Dynamic** categories: budget vs. actual = Σ transactions in the period.
- **Fixed monthly**: recurring auto-posts a transaction each period; counts toward
  expenses.
- **Fixed yearly**: realized as a monthly jar contribution (`amount / 12`); the
  actual annual payment is a jar withdrawal + an expense transaction.
- **Monthly overview**: income total, expense total (dynamic + fixed monthly + jar
  contributions), savings = income − expenses − net jar contributions, balance.
- **Assumption (confirmed):** budgets **reset monthly** (no rollover); lumpy/annual
  costs are carried by jars rather than by category rollover.
- **Assumption (confirmed, resolved by LDG-48):** jars are app-tracked virtual
  balances, not automatically reconciled against bank-account snapshots — but
  they now surface in net worth as their own explicit line, so the total picture
  isn't silently missing money the user has already set aside.

## SDK dependencies

| SDK surface  | Used for                                   | Available from |
| ------------ | ------------------------------------------ | -------------- |
| `sdk.auth`          | User session; owner scoping                         | Stable       |
| `sdk.db`            | Read/write all `ledger_*` tables                    | Stable       |
| `sdk.data`          | Expose budget/transaction/net-worth contracts       | Stable (RFC 0002) |
| `sdk.activity`      | Platform-visible financial setting/import events    | Stable (RFC 0005) |
| `sdk.notifications` | Optional monthly summary and reminder notifications | Stable (RFC 0015/0016) |
| `sdk.env`           | Instance-level FX/model/provider keys               | Stable (RFC 0018) |
| `sdk.secrets`       | Per-user FX provider credentials, if ever needed    | Stable (RFC 0043) |
| `sdk.portability`   | Export/import/delete participation                  | RFC 0007/0033, target before MVP ships |
| `sdk.billing`       | Would gate paid feature(s) once open-core is designed | **Blocked** — `getEntitlement()`/`requireEntitlement()` are unimplemented stubs (throw `NotImplementedError`, zero real call sites). Only whole-`routePrefix` paywalling is real (RFC 0003 Phase 1). See Open question 4. |
| `sdk.tools`         | Future confirmed assistant/automation writes        | RFC 0047, not yet shipped |

FX fetch runs in plugin server routes with explicit provider configuration.

### Data contracts

Candidate read-only contracts:

| Contract                   | Version | Shape                                |
| --------------------------- | ------- | ------------------------------------- |
| `ledger.monthly-summary`   | 1       | Income, expenses, savings, variance. |
| `ledger.transactions`      | 1       | User-scoped transaction rollups.     |
| `ledger.jars`              | 1       | Savings jar balances and targets.    |
| `ledger.net-worth`         | 1       | Monthly asset/liability snapshots (post-MVP). |

### Portability and deletion

Export includes settings, categories, budgets, transactions, recurring items,
and savings jars for MVP; asset/net-worth snapshots and people once Asset
Overview ships. Import restores data additively with remapped IDs, following
the same pattern as `sovereign-tasks`' `app/_lib/portability.ts`. User deletion
hard-deletes all owner-scoped financial data for that user.

## Platform capability cross-reference

| Platform capability            | Ledger usage                                                                  | Status / reference                |
| ------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------- |
| Authenticated plugin sessions   | Scope every query to the current user and tenant.                              | Stable `sdk.auth`                  |
| Plugin-owned database access    | Store all Ledger domain tables through the plugin DB surface.                  | Stable `sdk.db`                    |
| Cross-plugin data sharing       | Expose read-only budget/transaction/jar/net-worth contracts.                    | Stable (RFC 0002)                  |
| Plugin-scoped env vars          | Instance-level FX provider keys.                                                | Stable (RFC 0018)                  |
| Plugin secret vault             | Per-user FX provider credentials, if ever needed.                               | Stable (RFC 0043)                  |
| Notification Center             | Optional monthly summary / reminder notifications.                             | Stable (RFC 0015/0016)             |
| Activity logging                | Financial setting changes, imports.                                            | Stable (RFC 0005)                  |
| Plugin portability hooks        | Export/import/delete via Account-level orchestration.                          | RFC 0007/0033, target before MVP ships |
| Plugin monetization             | Would gate a future paid feature.                                              | **Blocked for open core** — in-code entitlement check unimplemented; only whole-plugin route paywalling is real (RFC 0003 Phase 1). See Open question 4. |
| Plugin scheduler                | Daily FX refresh, monthly recurring/jar auto-post.                             | Interval-only, no cron/persistence — see "Background jobs" (RFC 0046) |
| Plugin tool contracts           | Future assistant/automation actions (create expense, adjust jar).              | RFC 0047, not yet shipped          |

## UI

Default shell (platform sidebar). Primary screens:

- **Dashboard** — Finance Tracker monthly overview: income, expenses by group,
  savings, balance, and budget-vs-actual chips per category.
- **Expenses** — fast daily entry + filterable list.
- **Budget** — category tree editor + per-(sub)category allocations.
- **Jars** — balances, contributions, withdrawals, progress to target.
- **Net worth** *(post-MVP)* — monthly asset/liability snapshot grid + trend,
  including the jar "set aside" line.
- **Settings** — currencies, month-start day, income sources, FX overrides.

Consume `@sovereignfs/ui` primitives where they exist (currency input, balance
chip). Keep finance-specific composites (budget-vs-actual chip, jar progress,
net-worth grid) **in-plugin** — Ledger is a separate open-source repo, not
part of the core platform, and must not push Ledger-specific components into
the public design system (`packages/ui` stays a core-monorepo package).

## Future integrations

In a later phase, Ledger will **consume Splitify** shared-expense data via the
platform's generic, consent-gated **cross-plugin data-sharing mechanism**
(specified abstractly in the open-source **RFC 0002 — Cross-plugin data sharing**,
which never names Ledger). With explicit user consent, Ledger queries
Splitify's exposed `expenses`/balances contract and auto-creates or updates its own
transactions (e.g., the user's net share of group expenses), then keeps them in
sync. Consent is revocable; without it, no data is read.

> The core platform's public RFC 0002 doc, SRS, and SDK stub describe the
> cross-plugin sharing mechanism generically and name no specific plugin
> (Ledger, Splitify, or otherwise) — that's a core-repo documentation
> convention, independent of any one plugin's own license. This spec, being
> Ledger's own doc, is where the concrete Splitify integration is named.

## Build plan

### Finance Tracker (MVP) — v0.1–v0.4

Each milestone is a self-contained increment, built and shipped before Asset
Overview starts. v0.1–v0.3 deliver the core budgeting loop and jars in base
currency; v0.4 adds multi-currency. Real implementation targets the current
plugin database SDK and the RFC-backed platform surfaces called out above.

**Done when:** a user can set up income/categories/budgets, log expenses,
run fixed/recurring costs automatically, contribute to and withdraw from
jars, and do all of it in more than one currency with correct FX handling.

### Asset Overview (post-MVP) — v0.5–v0.6

Not scheduled. Specified now so the pillar boundary and data model
(`ledger_assets`/`ledger_asset_snapshots`/`ledger_people`, expanded asset
classes, jar-linked net worth) are settled before Finance Tracker's schema is
locked in, avoiding later migrations to bolt this pillar on.

### Cross-pillar (post-MVP) — v0.7

Insights and CSV export, after both pillars exist to draw from.

## Open questions

1. **FX providers** — Frankfurter/exchangerate.host (fiat) + CoinGecko
   (crypto). Confirm; is crypto valuation in MVP or deferred?
2. **Budget rollover** — confirmed monthly reset + jars for carry-over (see
   "Monthly cycle and budget tracking").
3. **Stock/metal prices** — manual snapshot in MVP-adjacent Asset Overview
   work; optional live pricing later?
4. **Paid tier design — blocked as specced, not just deferred.** The
   "open core, in-code entitlement gate" model this doc originally assumed
   needs `sdk.billing.getEntitlement()`/`requireEntitlement()`, which are
   unimplemented stubs today (confirmed by code audit — see "Current platform
   state"). Only whole-plugin route paywalling is real. Doesn't block Finance
   Tracker MVP (no monetization there), but the paid-feature plan needs one of:
   (a) wait for real in-code entitlement support to ship platform-side, (b)
   redesign the paid feature as something separately paywallable (e.g. its own
   route/sub-plugin, gated at `routePrefix` level), or (c) gate manually/
   externally for now instead of via `sdk.billing`. Not resolved; revisit
   before Asset Overview work starts.
5. **Licensing** — ✅ **Resolved.** AGPLv3, matching the core platform and
   `sovereign-tasks`, superseding the earlier proprietary "all rights
   reserved" plan.

## Changelog

| Version | Date     | Change |
| ------- | -------- | ------ |
| 0.3     | Jul 2026 | Documented three platform gaps found by a code audit: (1) monetization's "open core" plan is **blocked** — `sdk.billing.getEntitlement()` is an unimplemented stub, only whole-plugin route paywalling is real; reflected in the intro, "Current platform state," SDK/capability tables, and Open question 4. (2) The plugin scheduler has no cron, only interval polling with no persistence — added a new "Background jobs" section specifying the claim-column pattern for LDG-11/LDG-21/LDG-31, and added `last_posted_period`/`last_contributed_period` columns to `ledger_recurring`/`ledger_jars`. (3) Locked every `fx_rate`/`rate` column to a `text` canonical-decimal-string type (no dialect has a working `numeric`/`decimal` precedent in this codebase), resolving the earlier open question. |
| 0.2     | Jul 2026 | Flipped from proprietary/private-repo to **open source** (AGPLv3, public repo, `registry/plugins.json`-eligible) — open-core model retained: source is public, paid feature(s) still TBD and gated by signed entitlement (RFC 0003) rather than by hiding code. Resolved open question 5 (licensing). |
| 0.1     | Jul 2026 | Renamed from Ledgerly (`dev.kasun.ledgerly`) to Ledger (`fs.sovereign.ledger`). Restructured around two pillars: Finance Tracker (MVP) and Asset Overview (post-MVP, expanded with `real_estate`/`vehicle` asset classes, per-asset institution/tags/notes, and a jar-linked net-worth line, LDG-48). Table prefix renamed `ledgerly_*` → `ledger_*`. Confirmed proprietary/private-repo status and free-at-MVP monetization. Folded former v0.6 "Insights" into a post-MVP cross-pillar milestone alongside CSV export. Updated SDK dependency table to reflect current platform state — `sdk.data`, `sdk.secrets`, `sdk.activity`, `sdk.notifications`, `sdk.env` are all stable; only `sdk.tools` (RFC 0047) and monetization Phase 2 payments remain unshipped. |
