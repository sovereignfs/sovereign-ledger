import { getTableName, type Table } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DeletionContext,
  ExportContext,
  ImportContext,
  PluginExportSection,
} from '@sovereignfs/sdk';

type Row = Record<string, unknown>;
type Condition = { kind: 'eq'; key: string; value: unknown } | { kind: 'and'; conditions: Condition[] };

function toCamel(snake: string): string {
  return snake.replace(/_([a-z0-9])/g, (_match, c: string) => c.toUpperCase());
}

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (column: { name: string }, value: unknown): Condition => ({
      kind: 'eq',
      key: toCamel(column.name),
      value,
    }),
    and: (...conditions: Condition[]): Condition => ({ kind: 'and', conditions }),
  };
});

function matches(row: Row, condition?: Condition): boolean {
  if (!condition) return true;
  if (condition.kind === 'eq') return row[condition.key] === condition.value;
  return condition.conditions.every((c) => matches(row, c));
}

const capturedExporter = { fn: null as ((ctx: ExportContext) => Promise<PluginExportSection>) | null };
const capturedImporter = {
  fn: null as ((section: PluginExportSection, ctx: ImportContext) => Promise<void>) | null,
};
const capturedDeleter = {
  fn: null as ((ctx: DeletionContext) => Promise<{ deleted: number; errors?: string[] }>) | null,
};

vi.mock('@sovereignfs/sdk', () => ({
  sdk: {
    db: { getClient: vi.fn(async () => fakeDb) },
    portability: {
      provideExport: vi.fn(async (fn: typeof capturedExporter.fn) => {
        capturedExporter.fn = fn;
      }),
      provideImport: vi.fn(async (fn: typeof capturedImporter.fn) => {
        capturedImporter.fn = fn;
      }),
      provideDelete: vi.fn(async (fn: typeof capturedDeleter.fn) => {
        capturedDeleter.fn = fn;
      }),
    },
  },
}));

const TABLE_NAMES = [
  'ledger_settings',
  'ledger_income_sources',
  'ledger_income_entries',
  'ledger_categories',
  'ledger_budgets',
  'ledger_transactions',
  'ledger_recurring',
  'ledger_jars',
  'ledger_jar_entries',
  'ledger_assets',
  'ledger_asset_snapshots',
  'ledger_people',
] as const;

type Store = Record<(typeof TABLE_NAMES)[number], Row[]>;

let store: Store = Object.fromEntries(TABLE_NAMES.map((n) => [n, []])) as unknown as Store;

function resetStore() {
  store = Object.fromEntries(TABLE_NAMES.map((n) => [n, []])) as unknown as Store;
}

const fakeDb = {
  select(columns?: Record<string, unknown>) {
    return {
      from(table: Table) {
        const tableName = getTableName(table);
        return {
          where: async (condition?: Condition) => {
            const rows = (store[tableName as keyof Store] ?? []).filter((row) =>
              matches(row, condition),
            );
            if (!columns) return rows;
            return rows.map((row) => {
              const projected: Row = {};
              for (const key of Object.keys(columns)) projected[key] = row[key];
              return projected;
            });
          },
        };
      },
    };
  },
  insert(table: Table) {
    const tableName = getTableName(table);
    return {
      values: async (row: Row) => {
        (store[tableName as keyof Store] ??= []).push(row);
      },
    };
  },
  delete(table: Table) {
    const tableName = getTableName(table);
    return {
      where: async (condition?: Condition) => {
        store[tableName as keyof Store] = (store[tableName as keyof Store] ?? []).filter(
          (row) => !matches(row, condition),
        );
      },
    };
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

describe('portability export', () => {
  it("exports only the user's own categories, transactions, and jars — never another user's", async () => {
    const { registerPortabilityHandlers } = await import('../portability');
    await registerPortabilityHandlers();

    store.ledger_categories = [
      { id: 'cat-1', tenantId: 't1', userId: 'u1', parentId: null, name: 'Groceries', group: 'dynamic', sortOrder: 0, archived: false, createdAt: 1, updatedAt: 1 },
      { id: 'cat-2', tenantId: 't1', userId: 'other', parentId: null, name: 'Not mine', group: 'dynamic', sortOrder: 0, archived: false, createdAt: 1, updatedAt: 1 },
    ];
    store.ledger_transactions = [
      { id: 'tx-1', tenantId: 't1', userId: 'u1', categoryId: 'cat-1', date: '2026-01-01', amount: 500, currency: 'USD', fxMode: 'base', fxRate: null, baseAmount: 500, note: null, source: 'manual', recurringId: null, jarId: null, deletedAt: null, createdAt: 1, updatedAt: 1 },
      { id: 'tx-2', tenantId: 't1', userId: 'other', categoryId: 'cat-2', date: '2026-01-01', amount: 500, currency: 'USD', fxMode: 'base', fxRate: null, baseAmount: 500, note: null, source: 'manual', recurringId: null, jarId: null, deletedAt: null, createdAt: 1, updatedAt: 1 },
    ];
    store.ledger_jars = [
      { id: 'jar-1', tenantId: 't1', userId: 'u1', name: 'Vacation', monthlyContribution: 100, currency: 'USD', targetAmount: null, linkedRecurringId: null, active: true, sortOrder: 0, lastContributedPeriod: null, createdAt: 1, updatedAt: 1 },
    ];

    const section = await capturedExporter.fn?.({
      userId: 'u1',
      tenantId: 't1',
      options: { includeFiles: true },
    });
    expect(section).toBeDefined();

    const data = (section as PluginExportSection).data as {
      categories: { id: string }[];
      transactions: { id: string }[];
      jars: { id: string }[];
    };
    expect(data.categories.map((c) => c.id)).toEqual(['cat-1']);
    expect(data.transactions.map((t) => t.id)).toEqual(['tx-1']);
    expect(data.jars.map((j) => j.id)).toEqual(['jar-1']);
  });
});

describe('portability import', () => {
  it('remaps a transaction its category id and scopes it to the importing user', async () => {
    const { registerPortabilityHandlers } = await import('../portability');
    await registerPortabilityHandlers();

    const section: PluginExportSection = {
      pluginId: 'fs.sovereign.ledger',
      schemaVersion: 1,
      data: {
        settings: null,
        incomeSources: [],
        incomeEntries: [],
        categories: [
          { id: 'src-cat-1', parentId: null, name: 'Groceries', group: 'dynamic', sortOrder: 0, archived: false, createdAt: 1, updatedAt: 1 },
        ],
        budgets: [],
        transactions: [
          { id: 'src-tx-1', categoryId: 'src-cat-1', date: '2026-01-01', amount: 500, currency: 'USD', fxMode: 'base', fxRate: null, baseAmount: 500, note: null, source: 'manual', recurringId: null, jarId: null, deletedAt: null, createdAt: 1, updatedAt: 1 },
        ],
        recurring: [],
        jars: [],
        jarEntries: [],
        assets: [],
        assetSnapshots: [],
        people: [],
      },
    };

    const remapId = (id: string) => `new-${id}`;
    await capturedImporter.fn?.(section, { userId: 'u2', tenantId: 't1', remapId });

    expect(store.ledger_categories).toEqual([
      expect.objectContaining({ id: 'new-src-cat-1', tenantId: 't1', userId: 'u2' }),
    ]);
    expect(store.ledger_transactions).toEqual([
      expect.objectContaining({
        id: 'new-src-tx-1',
        categoryId: 'new-src-cat-1',
        tenantId: 't1',
        userId: 'u2',
      }),
    ]);
  });

  it('skips a transaction whose categoryId is not part of this export', async () => {
    const { registerPortabilityHandlers } = await import('../portability');
    await registerPortabilityHandlers();

    const section: PluginExportSection = {
      pluginId: 'fs.sovereign.ledger',
      schemaVersion: 1,
      data: {
        settings: null,
        incomeSources: [],
        incomeEntries: [],
        categories: [],
        budgets: [],
        transactions: [
          { id: 'orphan-tx', categoryId: 'missing-cat', date: '2026-01-01', amount: 1, currency: 'USD', fxMode: 'base', fxRate: null, baseAmount: 1, note: null, source: 'manual', recurringId: null, jarId: null, deletedAt: null, createdAt: 1, updatedAt: 1 },
        ],
        recurring: [],
        jars: [],
        jarEntries: [],
        assets: [],
        assetSnapshots: [],
        people: [],
      },
    };

    await capturedImporter.fn?.(section, { userId: 'u2', tenantId: 't1', remapId: (id) => `new-${id}` });
    expect(store.ledger_transactions).toEqual([]);
  });
});

describe('portability delete', () => {
  it("deletes only the user's own rows across every table, including settings", async () => {
    const { registerPortabilityHandlers } = await import('../portability');
    await registerPortabilityHandlers();

    store.ledger_categories = [
      { id: 'cat-1', tenantId: 't1', userId: 'u1', parentId: null, name: 'Mine', group: 'dynamic', sortOrder: 0, archived: false, createdAt: 1, updatedAt: 1 },
      { id: 'cat-2', tenantId: 't1', userId: 'other', parentId: null, name: 'Not mine', group: 'dynamic', sortOrder: 0, archived: false, createdAt: 1, updatedAt: 1 },
    ];
    store.ledger_settings = [
      { tenantId: 't1', userId: 'u1', baseCurrency: 'USD', displayCurrency: null, monthStartDay: 1, createdAt: 1, updatedAt: 1 },
      { tenantId: 't1', userId: 'other', baseCurrency: 'USD', displayCurrency: null, monthStartDay: 1, createdAt: 1, updatedAt: 1 },
    ];

    const result = await capturedDeleter.fn?.({ userId: 'u1', tenantId: 't1', db: fakeDb });
    expect(result).toBeDefined();

    expect(store.ledger_categories).toEqual([expect.objectContaining({ id: 'cat-2' })]);
    expect(store.ledger_settings).toEqual([expect.objectContaining({ userId: 'other' })]);
    expect(result?.deleted).toBeGreaterThan(0);
  });
});
