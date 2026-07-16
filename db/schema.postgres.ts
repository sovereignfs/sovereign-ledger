import { integer, pgTable, primaryKey, text, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Plugin schema — Ledger (Postgres dialect, migration-generation only).
 *
 * Not imported by application code — `db/schema.ts` (SQLite-core builders) is
 * the single schema application code queries against, regardless of which
 * dialect actually backs `sdk.db.getClient()` in production. Drizzle's runtime
 * query builder is bound to the client instance's own dialect (`node-postgres`
 * vs `better-sqlite3`), not to the table object's origin, so the SQLite-typed
 * table objects work correctly against a Postgres connection as long as the
 * physical columns use types that serialize identically (verified pattern,
 * see sovereign-tasks' identical schema.postgres.ts comment).
 *
 * This file exists solely to drive `pnpm db:generate:pg` for
 * `migrations/postgres/`; keep it a structural mirror of `schema.ts` and
 * NEVER use native Postgres `boolean`, `numeric`/`decimal`, or `bigint` types
 * here — that would create physical columns whose types the SQLite-typed
 * query objects don't know how to serialize/deserialize against, breaking
 * writes at runtime. (This is also why every `fx_rate`/`rate` column is
 * `text`, not Postgres `numeric` — see schema.ts's own header comment.)
 */

export const ledgerSettings = pgTable(
  'ledger_settings',
  {
    tenantId: text('tenant_id').notNull(),
    userId: text('user_id').notNull(),
    baseCurrency: text('base_currency').notNull(),
    displayCurrency: text('display_currency'),
    monthStartDay: integer('month_start_day').notNull().default(1),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId] })],
);

export const ledgerIncomeSources = pgTable('ledger_income_sources', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  expectedAmount: integer('expected_amount').notNull(),
  currency: text('currency').notNull(),
  cadence: text('cadence').notNull(),
  active: integer('active').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerIncomeEntries = pgTable('ledger_income_entries', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  sourceId: text('source_id').notNull(),
  period: text('period').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  fxRate: text('fx_rate').notNull().default('1'),
  baseAmount: integer('base_amount').notNull(),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerCategories = pgTable('ledger_categories', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  parentId: text('parent_id'),
  name: text('name').notNull(),
  group: text('group').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  archived: integer('archived').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerBudgets = pgTable('ledger_budgets', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  categoryId: text('category_id').notNull(),
  period: text('period'),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerTransactions = pgTable('ledger_transactions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  categoryId: text('category_id').notNull(),
  date: text('date').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  fxMode: text('fx_mode').notNull().default('base'),
  fxRate: text('fx_rate'),
  baseAmount: integer('base_amount').notNull(),
  note: text('note'),
  source: text('source').notNull().default('manual'),
  recurringId: text('recurring_id'),
  jarId: text('jar_id'),
  deletedAt: integer('deleted_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerRecurring = pgTable('ledger_recurring', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  categoryId: text('category_id').notNull(),
  name: text('name').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  cadence: text('cadence').notNull(),
  fxMode: text('fx_mode').notNull().default('locked'),
  schedule: text('schedule').notNull().default('{}'),
  jarId: text('jar_id'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  active: integer('active').notNull().default(1),
  lastPostedPeriod: text('last_posted_period'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerJars = pgTable('ledger_jars', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  monthlyContribution: integer('monthly_contribution').notNull(),
  currency: text('currency').notNull(),
  targetAmount: integer('target_amount'),
  linkedRecurringId: text('linked_recurring_id'),
  active: integer('active').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
  lastContributedPeriod: text('last_contributed_period'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerJarEntries = pgTable('ledger_jar_entries', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  jarId: text('jar_id').notNull(),
  period: text('period'),
  date: text('date'),
  type: text('type').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  fxRate: text('fx_rate'),
  baseAmount: integer('base_amount').notNull(),
  note: text('note'),
  transactionId: text('transaction_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerFxRates = pgTable(
  'ledger_fx_rates',
  {
    id: text('id').primaryKey(),
    base: text('base').notNull(),
    quote: text('quote').notNull(),
    rate: text('rate').notNull(),
    asOf: text('as_of').notNull(),
    source: text('source').notNull(),
    fetchedAt: integer('fetched_at').notNull(),
  },
  (t) => [uniqueIndex('ledger_fx_rates_base_quote_as_of_source').on(t.base, t.quote, t.asOf, t.source)],
);

export const ledgerAssets = pgTable('ledger_assets', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  class: text('class').notNull(),
  currency: text('currency').notNull(),
  personId: text('person_id'),
  institution: text('institution'),
  tags: text('tags'),
  notes: text('notes'),
  active: integer('active').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerAssetSnapshots = pgTable('ledger_asset_snapshots', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  assetId: text('asset_id').notNull(),
  period: text('period').notNull(),
  value: integer('value').notNull(),
  currency: text('currency').notNull(),
  fxRate: text('fx_rate'),
  baseValue: integer('base_value').notNull(),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const ledgerPeople = pgTable('ledger_people', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
