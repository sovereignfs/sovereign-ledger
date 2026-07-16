# Ledger

A budget-first personal finance tracker for [Sovereign](https://github.com/sovereignfs/sovereign), with savings jars, multi-currency, and a net-worth asset overview.

**Status:** v0.1.0 — scaffold, pre-implementation
**Plugin ID:** `fs.sovereign.ledger`
**Route:** `/ledger`

---

## What it is

Ledger has two pillars:

1. **Finance Tracker** (MVP) — declare income and a category tree, set a budget per category, log daily expenses, and track fixed/recurring costs (monthly and yearly, the latter funded through savings jars) against those budgets. Multi-currency throughout.
2. **Asset Overview** (post-MVP) — manual monthly snapshots of assets, liabilities, and people (receivables/payables), rolled up into a net-worth view that includes money already set aside in Finance Tracker's jars.

See [SPEC.md](SPEC.md) for the full functional requirements and data model, and [roadmap.md](roadmap.md) for the build order.

Ledger runs on your own Sovereign instance. Users sign in with their Sovereign account; data is stored on and synced through your instance server.

## Installing on a Sovereign instance

```bash
sv plugin add https://github.com/sovereignfs/sovereign-ledger
```

Then restart the runtime. Ledger will appear in the launcher as **Ledger**.

## Local development

The plugin is developed as a `.local` workspace member inside the platform monorepo.

```bash
# From the platform monorepo root
pnpm dev   # runtime on :3000; plugin routes live at /ledger
```

After changing the database schema (`db/schema.ts`), hand-author a matching
SQLite migration under `migrations/sqlite/` (no generate step for SQLite),
append an entry to `migrations/sqlite/meta/_journal.json`, and regenerate the
Postgres migration via:

```bash
pnpm db:generate:pg
```

See the [plugin development guide](../../docs/plugin-development.md) for the full workflow.

## Stack

- **Language:** TypeScript, React (Next.js App Router)
- **Database:** shared platform database via `sdk.db` — no direct `@sovereignfs/db` imports
- **UI:** `@sovereignfs/ui` components and `--sv-*` tokens exclusively

## Requirements

- Sovereign platform ≥ `0.26.4`
- Node ≥ 20
- pnpm 11.5.x (platform monorepo convention)

## Spec

Full functional requirements, data model, and milestone definitions: [SPEC.md](SPEC.md)

## License

AGPL-3.0-or-later — same license as the [Sovereign platform](https://github.com/sovereignfs/sovereign). See [LICENSE](LICENSE).
