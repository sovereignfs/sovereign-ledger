import { sdk } from '@sovereignfs/sdk';
import type {
  DeletionContext,
  DeletionResult,
  ExportContext,
  ImportContext,
  PluginExportSection,
} from '@sovereignfs/sdk';
import { and, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import {
  ledgerAssetSnapshots,
  ledgerAssets,
  ledgerBudgets,
  ledgerCategories,
  ledgerIncomeEntries,
  ledgerIncomeSources,
  ledgerJarEntries,
  ledgerJars,
  ledgerPeople,
  ledgerRecurring,
  ledgerSettings,
  ledgerTransactions,
} from '../_db/schema';

// The SDK intentionally returns an opaque dialect-agnostic DB client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BaseSQLiteDatabase<'async', any, any>;

const PLUGIN_ID = 'fs.sovereign.ledger';
const EXPORT_SCHEMA_VERSION = 1;

/**
 * Registers Ledger's export/import/delete participation (RFC 0007 / RFC 0033,
 * RFC 0068). Must be called from a request-scoped Ledger route — this repo
 * calls it from `app/layout.tsx`, same as every other request-scoped setup
 * (registrations are in-process and reset on restart).
 *
 * `ledger_fx_rates` is deliberately excluded — it's a shared, instance-level
 * public market-data cache with no `tenant_id`/`user_id` (see its own schema
 * comment), not personal data.
 */
export async function registerPortabilityHandlers(): Promise<void> {
  await sdk.portability.provideExport(exportLedgerData);
  await sdk.portability.provideImport(importLedgerData);
  await sdk.portability.provideDelete(deleteAllLedgerData);
}

// ---- Export shape ----
// Keyed by each row's *original* id — the import handler remaps every
// plugin-owned id via ctx.remapId, so cross-references below travel as the
// original id and get translated at import time.

interface ExportSettings {
  baseCurrency: string;
  displayCurrency: string | null;
  monthStartDay: number;
  createdAt: number;
  updatedAt: number;
}

interface ExportIncomeSource {
  id: string;
  name: string;
  kind: string;
  expectedAmount: number;
  currency: string;
  cadence: string;
  active: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

interface ExportIncomeEntry {
  id: string;
  sourceId: string;
  period: string;
  amount: number;
  currency: string;
  fxRate: string;
  baseAmount: number;
  note: string | null;
  createdAt: number;
  updatedAt: number;
}

interface ExportCategory {
  id: string;
  parentId: string | null;
  name: string;
  group: string;
  sortOrder: number;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

interface ExportBudget {
  id: string;
  categoryId: string;
  period: string | null;
  amount: number;
  currency: string;
  createdAt: number;
  updatedAt: number;
}

interface ExportTransaction {
  id: string;
  categoryId: string;
  date: string;
  amount: number;
  currency: string;
  fxMode: string;
  fxRate: string | null;
  baseAmount: number;
  note: string | null;
  source: string;
  recurringId: string | null;
  jarId: string | null;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface ExportRecurring {
  id: string;
  categoryId: string;
  name: string;
  amount: number;
  currency: string;
  cadence: string;
  fxMode: string;
  schedule: string;
  jarId: string | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  lastPostedPeriod: string | null;
  createdAt: number;
  updatedAt: number;
}

interface ExportJar {
  id: string;
  name: string;
  monthlyContribution: number;
  currency: string;
  targetAmount: number | null;
  linkedRecurringId: string | null;
  active: boolean;
  sortOrder: number;
  lastContributedPeriod: string | null;
  createdAt: number;
  updatedAt: number;
}

interface ExportJarEntry {
  id: string;
  jarId: string;
  period: string | null;
  date: string | null;
  type: string;
  amount: number;
  currency: string;
  fxRate: string | null;
  baseAmount: number;
  note: string | null;
  transactionId: string | null;
  createdAt: number;
  updatedAt: number;
}

interface ExportAsset {
  id: string;
  name: string;
  class: string;
  currency: string;
  personId: string | null;
  institution: string | null;
  tags: string | null;
  notes: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

interface ExportAssetSnapshot {
  id: string;
  assetId: string;
  period: string;
  value: number;
  currency: string;
  fxRate: string | null;
  baseValue: number;
  note: string | null;
  createdAt: number;
  updatedAt: number;
}

interface ExportPerson {
  id: string;
  name: string;
  note: string | null;
  createdAt: number;
  updatedAt: number;
}

interface LedgerExportData {
  /** null when the user never opened Ledger (no settings row exists). */
  settings: ExportSettings | null;
  incomeSources: ExportIncomeSource[];
  incomeEntries: ExportIncomeEntry[];
  categories: ExportCategory[];
  budgets: ExportBudget[];
  transactions: ExportTransaction[];
  recurring: ExportRecurring[];
  jars: ExportJar[];
  jarEntries: ExportJarEntry[];
  assets: ExportAsset[];
  assetSnapshots: ExportAssetSnapshot[];
  people: ExportPerson[];
}

async function exportLedgerData(ctx: ExportContext): Promise<PluginExportSection> {
  const db = (await sdk.db.getClient()) as Db;
  const { userId, tenantId } = ctx;
  const own = (table: { tenantId: unknown; userId: unknown }) =>
    and(eq(table.tenantId as never, tenantId), eq(table.userId as never, userId));

  const [
    settingsRows,
    incomeSourceRows,
    incomeEntryRows,
    categoryRows,
    budgetRows,
    transactionRows,
    recurringRows,
    jarRows,
    jarEntryRows,
    assetRows,
    assetSnapshotRows,
    peopleRows,
  ] = await Promise.all([
    db.select().from(ledgerSettings).where(own(ledgerSettings)),
    db.select().from(ledgerIncomeSources).where(own(ledgerIncomeSources)),
    db.select().from(ledgerIncomeEntries).where(own(ledgerIncomeEntries)),
    db.select().from(ledgerCategories).where(own(ledgerCategories)),
    db.select().from(ledgerBudgets).where(own(ledgerBudgets)),
    db.select().from(ledgerTransactions).where(own(ledgerTransactions)),
    db.select().from(ledgerRecurring).where(own(ledgerRecurring)),
    db.select().from(ledgerJars).where(own(ledgerJars)),
    db.select().from(ledgerJarEntries).where(own(ledgerJarEntries)),
    db.select().from(ledgerAssets).where(own(ledgerAssets)),
    db.select().from(ledgerAssetSnapshots).where(own(ledgerAssetSnapshots)),
    db.select().from(ledgerPeople).where(own(ledgerPeople)),
  ]);

  const settingsRow = settingsRows[0];
  const data: LedgerExportData = {
    settings: settingsRow
      ? {
          baseCurrency: settingsRow.baseCurrency,
          displayCurrency: settingsRow.displayCurrency,
          monthStartDay: settingsRow.monthStartDay,
          createdAt: settingsRow.createdAt,
          updatedAt: settingsRow.updatedAt,
        }
      : null,
    incomeSources: incomeSourceRows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      expectedAmount: r.expectedAmount,
      currency: r.currency,
      cadence: r.cadence,
      active: r.active,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    incomeEntries: incomeEntryRows.map((r) => ({
      id: r.id,
      sourceId: r.sourceId,
      period: r.period,
      amount: r.amount,
      currency: r.currency,
      fxRate: r.fxRate,
      baseAmount: r.baseAmount,
      note: r.note,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    categories: categoryRows.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      name: r.name,
      group: r.group,
      sortOrder: r.sortOrder,
      archived: r.archived,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    budgets: budgetRows.map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      period: r.period,
      amount: r.amount,
      currency: r.currency,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    transactions: transactionRows.map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      date: r.date,
      amount: r.amount,
      currency: r.currency,
      fxMode: r.fxMode,
      fxRate: r.fxRate,
      baseAmount: r.baseAmount,
      note: r.note,
      source: r.source,
      recurringId: r.recurringId,
      jarId: r.jarId,
      deletedAt: r.deletedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    recurring: recurringRows.map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      name: r.name,
      amount: r.amount,
      currency: r.currency,
      cadence: r.cadence,
      fxMode: r.fxMode,
      schedule: r.schedule,
      jarId: r.jarId,
      startDate: r.startDate,
      endDate: r.endDate,
      active: r.active,
      lastPostedPeriod: r.lastPostedPeriod,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    jars: jarRows.map((r) => ({
      id: r.id,
      name: r.name,
      monthlyContribution: r.monthlyContribution,
      currency: r.currency,
      targetAmount: r.targetAmount,
      linkedRecurringId: r.linkedRecurringId,
      active: r.active,
      sortOrder: r.sortOrder,
      lastContributedPeriod: r.lastContributedPeriod,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    jarEntries: jarEntryRows.map((r) => ({
      id: r.id,
      jarId: r.jarId,
      period: r.period,
      date: r.date,
      type: r.type,
      amount: r.amount,
      currency: r.currency,
      fxRate: r.fxRate,
      baseAmount: r.baseAmount,
      note: r.note,
      transactionId: r.transactionId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    assets: assetRows.map((r) => ({
      id: r.id,
      name: r.name,
      class: r.class,
      currency: r.currency,
      personId: r.personId,
      institution: r.institution,
      tags: r.tags,
      notes: r.notes,
      active: r.active,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    assetSnapshots: assetSnapshotRows.map((r) => ({
      id: r.id,
      assetId: r.assetId,
      period: r.period,
      value: r.value,
      currency: r.currency,
      fxRate: r.fxRate,
      baseValue: r.baseValue,
      note: r.note,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    people: peopleRows.map((r) => ({
      id: r.id,
      name: r.name,
      note: r.note,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  };

  return { pluginId: PLUGIN_ID, schemaVersion: EXPORT_SCHEMA_VERSION, data };
}

// ---- Import ----
// Additive only — never overwrites existing data. Every plugin-owned id goes
// through ctx.remapId(); a row whose referenced id isn't actually part of
// this export is imported with that reference nulled out rather than
// hard-failed, same convention Tasks/Shopper use.

function isLedgerExportData(value: unknown): value is LedgerExportData {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<LedgerExportData>;
  return (
    Array.isArray(c.incomeSources) &&
    Array.isArray(c.incomeEntries) &&
    Array.isArray(c.categories) &&
    Array.isArray(c.budgets) &&
    Array.isArray(c.transactions) &&
    Array.isArray(c.recurring) &&
    Array.isArray(c.jars) &&
    Array.isArray(c.jarEntries) &&
    Array.isArray(c.assets) &&
    Array.isArray(c.assetSnapshots) &&
    Array.isArray(c.people)
  );
}

async function importLedgerData(section: PluginExportSection, ctx: ImportContext): Promise<void> {
  if (section.schemaVersion !== EXPORT_SCHEMA_VERSION || !isLedgerExportData(section.data)) {
    throw new Error('Ledger import section has an unrecognized shape.');
  }
  const data = section.data;
  const db = (await sdk.db.getClient()) as Db;
  const ts = Math.floor(Date.now() / 1000);

  const originalCategoryIds = new Set(data.categories.map((c) => c.id));
  const originalSourceIds = new Set(data.incomeSources.map((s) => s.id));
  const originalRecurringIds = new Set(data.recurring.map((r) => r.id));
  const originalJarIds = new Set(data.jars.map((j) => j.id));
  const originalTransactionIds = new Set(data.transactions.map((t) => t.id));
  const originalAssetIds = new Set(data.assets.map((a) => a.id));
  const originalPersonIds = new Set(data.people.map((p) => p.id));

  // ledger_settings is a per-user singleton (PK tenantId+userId) — seed only
  // when the importing account doesn't already have one, same rule Tasks
  // applies to its own singleton row.
  if (data.settings) {
    const existing = await db
      .select({ userId: ledgerSettings.userId })
      .from(ledgerSettings)
      .where(and(eq(ledgerSettings.tenantId, ctx.tenantId), eq(ledgerSettings.userId, ctx.userId)));
    if (existing.length === 0) {
      await db.insert(ledgerSettings).values({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        baseCurrency: data.settings.baseCurrency,
        displayCurrency: data.settings.displayCurrency,
        monthStartDay: data.settings.monthStartDay,
        createdAt: data.settings.createdAt,
        updatedAt: ts,
      });
    }
  }

  for (const c of data.categories) {
    await db.insert(ledgerCategories).values({
      id: ctx.remapId(c.id),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      parentId: c.parentId && originalCategoryIds.has(c.parentId) ? ctx.remapId(c.parentId) : null,
      name: c.name,
      group: c.group,
      sortOrder: c.sortOrder,
      archived: c.archived,
      createdAt: c.createdAt,
      updatedAt: ts,
    });
  }

  for (const s of data.incomeSources) {
    await db.insert(ledgerIncomeSources).values({
      id: ctx.remapId(s.id),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      name: s.name,
      kind: s.kind,
      expectedAmount: s.expectedAmount,
      currency: s.currency,
      cadence: s.cadence,
      active: s.active,
      sortOrder: s.sortOrder,
      createdAt: s.createdAt,
      updatedAt: ts,
    });
  }

  for (const e of data.incomeEntries) {
    if (!originalSourceIds.has(e.sourceId)) continue;
    await db.insert(ledgerIncomeEntries).values({
      id: ctx.remapId(e.id),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      sourceId: ctx.remapId(e.sourceId),
      period: e.period,
      amount: e.amount,
      currency: e.currency,
      fxRate: e.fxRate,
      baseAmount: e.baseAmount,
      note: e.note,
      createdAt: e.createdAt,
      updatedAt: ts,
    });
  }

  for (const b of data.budgets) {
    if (!originalCategoryIds.has(b.categoryId)) continue;
    await db.insert(ledgerBudgets).values({
      id: ctx.remapId(b.id),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      categoryId: ctx.remapId(b.categoryId),
      period: b.period,
      amount: b.amount,
      currency: b.currency,
      createdAt: b.createdAt,
      updatedAt: ts,
    });
  }

  for (const j of data.jars) {
    await db.insert(ledgerJars).values({
      id: ctx.remapId(j.id),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      name: j.name,
      monthlyContribution: j.monthlyContribution,
      currency: j.currency,
      targetAmount: j.targetAmount,
      linkedRecurringId:
        j.linkedRecurringId && originalRecurringIds.has(j.linkedRecurringId)
          ? ctx.remapId(j.linkedRecurringId)
          : null,
      active: j.active,
      sortOrder: j.sortOrder,
      lastContributedPeriod: j.lastContributedPeriod,
      createdAt: j.createdAt,
      updatedAt: ts,
    });
  }

  for (const r of data.recurring) {
    if (!originalCategoryIds.has(r.categoryId)) continue;
    await db.insert(ledgerRecurring).values({
      id: ctx.remapId(r.id),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      categoryId: ctx.remapId(r.categoryId),
      name: r.name,
      amount: r.amount,
      currency: r.currency,
      cadence: r.cadence,
      fxMode: r.fxMode,
      schedule: r.schedule,
      jarId: r.jarId && originalJarIds.has(r.jarId) ? ctx.remapId(r.jarId) : null,
      startDate: r.startDate,
      endDate: r.endDate,
      active: r.active,
      lastPostedPeriod: r.lastPostedPeriod,
      createdAt: r.createdAt,
      updatedAt: ts,
    });
  }

  for (const t of data.transactions) {
    if (!originalCategoryIds.has(t.categoryId)) continue;
    await db.insert(ledgerTransactions).values({
      id: ctx.remapId(t.id),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      categoryId: ctx.remapId(t.categoryId),
      date: t.date,
      amount: t.amount,
      currency: t.currency,
      fxMode: t.fxMode,
      fxRate: t.fxRate,
      baseAmount: t.baseAmount,
      note: t.note,
      source: t.source,
      recurringId:
        t.recurringId && originalRecurringIds.has(t.recurringId) ? ctx.remapId(t.recurringId) : null,
      jarId: t.jarId && originalJarIds.has(t.jarId) ? ctx.remapId(t.jarId) : null,
      deletedAt: t.deletedAt,
      createdAt: t.createdAt,
      updatedAt: ts,
    });
  }

  for (const je of data.jarEntries) {
    if (!originalJarIds.has(je.jarId)) continue;
    await db.insert(ledgerJarEntries).values({
      id: ctx.remapId(je.id),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      jarId: ctx.remapId(je.jarId),
      period: je.period,
      date: je.date,
      type: je.type,
      amount: je.amount,
      currency: je.currency,
      fxRate: je.fxRate,
      baseAmount: je.baseAmount,
      note: je.note,
      transactionId:
        je.transactionId && originalTransactionIds.has(je.transactionId)
          ? ctx.remapId(je.transactionId)
          : null,
      createdAt: je.createdAt,
      updatedAt: ts,
    });
  }

  for (const p of data.people) {
    await db.insert(ledgerPeople).values({
      id: ctx.remapId(p.id),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      name: p.name,
      note: p.note,
      createdAt: p.createdAt,
      updatedAt: ts,
    });
  }

  for (const a of data.assets) {
    await db.insert(ledgerAssets).values({
      id: ctx.remapId(a.id),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      name: a.name,
      class: a.class,
      currency: a.currency,
      personId: a.personId && originalPersonIds.has(a.personId) ? ctx.remapId(a.personId) : null,
      institution: a.institution,
      tags: a.tags,
      notes: a.notes,
      active: a.active,
      sortOrder: a.sortOrder,
      createdAt: a.createdAt,
      updatedAt: ts,
    });
  }

  for (const as of data.assetSnapshots) {
    if (!originalAssetIds.has(as.assetId)) continue;
    await db.insert(ledgerAssetSnapshots).values({
      id: ctx.remapId(as.id),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      assetId: ctx.remapId(as.assetId),
      period: as.period,
      value: as.value,
      currency: as.currency,
      fxRate: as.fxRate,
      baseValue: as.baseValue,
      note: as.note,
      createdAt: as.createdAt,
      updatedAt: ts,
    });
  }
}

// ---- Delete ----

async function deleteAllLedgerData(ctx: DeletionContext): Promise<DeletionResult> {
  const db = ctx.db as Db;
  let deleted = 0;
  const own = (table: { tenantId: unknown; userId: unknown }) =>
    and(eq(table.tenantId as never, ctx.tenantId), eq(table.userId as never, ctx.userId));

  const tables = [
    ledgerJarEntries,
    ledgerAssetSnapshots,
    ledgerTransactions,
    ledgerRecurring,
    ledgerJars,
    ledgerBudgets,
    ledgerIncomeEntries,
    ledgerIncomeSources,
    ledgerAssets,
    ledgerPeople,
    ledgerCategories,
  ] as const;

  for (const table of tables) {
    const rows = await db.select({ id: table.id }).from(table).where(own(table));
    await db.delete(table).where(own(table));
    deleted += rows.length;
  }

  const settingsRows = await db
    .select({ userId: ledgerSettings.userId })
    .from(ledgerSettings)
    .where(and(eq(ledgerSettings.tenantId, ctx.tenantId), eq(ledgerSettings.userId, ctx.userId)));
  await db
    .delete(ledgerSettings)
    .where(and(eq(ledgerSettings.tenantId, ctx.tenantId), eq(ledgerSettings.userId, ctx.userId)));
  deleted += settingsRows.length;

  return { deleted };
}
