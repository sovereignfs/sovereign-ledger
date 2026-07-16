import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Plugin schema — Ledger (`fs.sovereign.ledger`).
 *
 * Conventions (match platform schema / sovereign-tasks / sovereign-shopper):
 * - IDs: ULIDs stored as text.
 * - Timestamps: Unix epoch seconds stored as integer.
 * - Booleans: integer 0/1 (mode: 'boolean').
 * - Money: integer minor units (never float).
 * - `fx_rate`/`rate` columns: `text` holding a canonical decimal string —
 *   never a real numeric/decimal SQL type (none exists dialect-agnostically
 *   in this codebase) and never a binary float. Parse with a decimal-safe
 *   helper, never `parseFloat`. See SPEC.md's "Currency and FX model" and
 *   "Background jobs" sections.
 * - `tenant_id` + `user_id` on every user-scoped table (owner-scoped only —
 *   Ledger has no sharing model). `ledger_fx_rates` is the one deliberate
 *   exception — see its own comment below.
 * - All tables prefixed `ledger_`.
 *
 * This scaffold includes every MVP (Finance Tracker) and post-MVP (Asset
 * Overview) table up front, including columns that stay dormant until later
 * milestones (multi-currency FX columns, the `last_posted_period`/
 * `last_contributed_period` scheduler claim columns) — see roadmap.md Task 0
 * and SPEC.md's "Current platform state" for why this avoids later
 * migrations just to unlock those features.
 */

// ---------------------------------------------------------------------------
// Finance Tracker tables (MVP)
// ---------------------------------------------------------------------------

/** One row per user. */
export const ledgerSettings = sqliteTable(
  'ledger_settings',
  {
    tenantId: text('tenant_id').notNull(),
    userId: text('user_id').notNull(),
    /** ISO 4217. All `base_amount`/`base_value` columns across this schema are in this. */
    baseCurrency: text('base_currency').notNull(),
    /** Nullable. Defaults to `base_currency` when unset. */
    displayCurrency: text('display_currency'),
    /** 1-28; defines the monthly window offset. */
    monthStartDay: integer('month_start_day').notNull().default(1),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId] })],
);

export const ledgerIncomeSources = sqliteTable('ledger_income_sources', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  /** 'fixed' | 'dynamic' */
  kind: text('kind').notNull(),
  /** Minor units. */
  expectedAmount: integer('expected_amount').notNull(),
  currency: text('currency').notNull(),
  /** 'monthly' | 'yearly' | 'adhoc' */
  cadence: text('cadence').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerIncomeEntries = sqliteTable('ledger_income_entries', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  /** FK -> ledger_income_sources.id */
  sourceId: text('source_id').notNull(),
  /** 'YYYY-MM' */
  period: text('period').notNull(),
  /** Minor units, in `currency`. */
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  /** Canonical decimal string. Rate to base (locked); `'1'` if base. */
  fxRate: text('fx_rate').notNull().default('1'),
  /** Minor units in base currency. */
  baseAmount: integer('base_amount').notNull(),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerCategories = sqliteTable('ledger_categories', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  /** Null for top-level; else FK -> ledger_categories.id (subcategory). */
  parentId: text('parent_id'),
  name: text('name').notNull(),
  /** 'dynamic' | 'fixed_monthly' | 'fixed_yearly' */
  group: text('group').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerBudgets = sqliteTable('ledger_budgets', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  /** FK -> ledger_categories.id */
  categoryId: text('category_id').notNull(),
  /** 'YYYY-MM', or null for the default monthly budget. */
  period: text('period'),
  /** Minor units. */
  amount: integer('amount').notNull(),
  /** ISO 4217, normally base. */
  currency: text('currency').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** Expenses. */
export const ledgerTransactions = sqliteTable('ledger_transactions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  /** FK -> ledger_categories.id (a subcategory). */
  categoryId: text('category_id').notNull(),
  /** ISO date 'YYYY-MM-DD'. */
  date: text('date').notNull(),
  /** Minor units, in `currency`. */
  amount: integer('amount').notNull(),
  /** ISO 4217 or crypto symbol. */
  currency: text('currency').notNull(),
  /** 'base' | 'locked' | 'dynamic' */
  fxMode: text('fx_mode').notNull().default('base'),
  /** Canonical decimal string. Locked rate when fx_mode = 'locked'; null when 'dynamic'. */
  fxRate: text('fx_rate'),
  /** Minor units in base; recomputed each rollup when fx_mode = 'dynamic'. */
  baseAmount: integer('base_amount').notNull(),
  note: text('note'),
  /** 'manual' | 'recurring' | 'imported' */
  source: text('source').notNull().default('manual'),
  /** Nullable. FK -> ledger_recurring.id (when auto-posted). */
  recurringId: text('recurring_id'),
  /** Nullable. FK -> ledger_jars.id (when funded by a jar withdrawal). */
  jarId: text('jar_id'),
  /** Nullable Unix timestamp. Soft delete. */
  deletedAt: integer('deleted_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerRecurring = sqliteTable('ledger_recurring', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  /** FK -> ledger_categories.id (fixed group). */
  categoryId: text('category_id').notNull(),
  name: text('name').notNull(),
  /** Minor units. */
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  /** 'monthly' | 'yearly' */
  cadence: text('cadence').notNull(),
  /** 'dynamic' | 'locked' */
  fxMode: text('fx_mode').notNull().default('locked'),
  /** JSON string. Day-of-month / month-of-year. Defaults to '{}'. */
  schedule: text('schedule').notNull().default('{}'),
  /** Nullable. FK -> ledger_jars.id (yearly funding jar). */
  jarId: text('jar_id'),
  /** ISO date 'YYYY-MM-DD'. */
  startDate: text('start_date').notNull(),
  /** Nullable ISO date. */
  endDate: text('end_date'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  /**
   * Nullable 'YYYY-MM'. Scheduler claim column (LDG-11) — the auto-post job
   * advances this via a conditional UPDATE before inserting a transaction,
   * so an interval-tick handler can't double-post within the same period.
   * See SPEC.md's "Background jobs".
   */
  lastPostedPeriod: text('last_posted_period'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerJars = sqliteTable('ledger_jars', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  /** Minor units. */
  monthlyContribution: integer('monthly_contribution').notNull(),
  currency: text('currency').notNull(),
  /** Nullable. Minor units. */
  targetAmount: integer('target_amount'),
  /** Nullable. FK -> ledger_recurring.id. */
  linkedRecurringId: text('linked_recurring_id'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  /**
   * Nullable 'YYYY-MM'. Scheduler claim column (LDG-21) — same pattern as
   * ledger_recurring.last_posted_period, for the monthly auto-contribute job.
   */
  lastContributedPeriod: text('last_contributed_period'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerJarEntries = sqliteTable('ledger_jar_entries', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  /** FK -> ledger_jars.id */
  jarId: text('jar_id').notNull(),
  /** Nullable 'YYYY-MM' — set for contribution entries. */
  period: text('period'),
  /** Nullable ISO date 'YYYY-MM-DD' — set for withdrawal/adjustment entries. */
  date: text('date'),
  /** 'contribution' | 'withdrawal' | 'adjustment' */
  type: text('type').notNull(),
  /** Minor units. */
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  /** Nullable canonical decimal string. */
  fxRate: text('fx_rate'),
  /** Minor units in base currency. */
  baseAmount: integer('base_amount').notNull(),
  note: text('note'),
  /** Nullable. FK -> ledger_transactions.id — links a withdrawal to the expense it funded. */
  transactionId: text('transaction_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * Shared instance-level FX rate cache — deliberately NOT tenant/user-scoped.
 * A currency-pair rate is public market data, not personal data; caching it
 * once per instance (rather than per tenant) avoids redundant provider calls.
 * Unique on (base, quote, as_of, source) — the scheduler's daily-refresh job
 * upserts on this key as its conditional-claim mechanism (SPEC.md's
 * "Background jobs").
 */
export const ledgerFxRates = sqliteTable(
  'ledger_fx_rates',
  {
    id: text('id').primaryKey(),
    /** Quote currency (e.g. 'USD'). */
    base: text('base').notNull(),
    /** Against which (usually a user's base currency). */
    quote: text('quote').notNull(),
    /** Canonical decimal string. High-precision; avoids float drift. */
    rate: text('rate').notNull(),
    /** ISO date 'YYYY-MM-DD' the rate applies to. */
    asOf: text('as_of').notNull(),
    /** 'api' | 'manual' */
    source: text('source').notNull(),
    fetchedAt: integer('fetched_at').notNull(),
  },
  (t) => [uniqueIndex('ledger_fx_rates_base_quote_as_of_source').on(t.base, t.quote, t.asOf, t.source)],
);

// ---------------------------------------------------------------------------
// Asset Overview tables (post-MVP) — schema settled now, feature not scheduled
// ---------------------------------------------------------------------------

export const ledgerAssets = sqliteTable('ledger_assets', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  /** 'banking' | 'stock' | 'crypto' | 'metal' | 'deposit' | 'receivable' | 'loan' | 'real_estate' | 'vehicle' | 'other' */
  class: text('class').notNull(),
  currency: text('currency').notNull(),
  /** Nullable. FK -> ledger_people.id. */
  personId: text('person_id'),
  /** Nullable. Bank/broker name. */
  institution: text('institution'),
  /** Nullable JSON array of strings. */
  tags: text('tags'),
  /** Nullable free text. */
  notes: text('notes'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** Manual monthly entry. */
export const ledgerAssetSnapshots = sqliteTable('ledger_asset_snapshots', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  /** FK -> ledger_assets.id */
  assetId: text('asset_id').notNull(),
  /** 'YYYY-MM' */
  period: text('period').notNull(),
  /** Minor units, signed; negative/`loan` class = liability. */
  value: integer('value').notNull(),
  currency: text('currency').notNull(),
  /** Nullable canonical decimal string. */
  fxRate: text('fx_rate'),
  /** Minor units in base currency. */
  baseValue: integer('base_value').notNull(),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * Receivables/payables ("People" block) are modeled as ledger_assets rows of
 * class 'receivable'/'loan' carrying person_id — this table just holds the
 * person identity.
 */
export const ledgerPeople = sqliteTable('ledger_people', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
