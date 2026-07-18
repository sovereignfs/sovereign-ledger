'use server';

import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { ledgerCategories, ledgerSettings, ledgerTransactions } from '../_db/schema';
import { DEFAULT_CURRENCY } from './currencies';
import { type ActionResult, type Db, getContext } from './db';
import { formOptionalString, formString, now } from './formUtils';
import { majorToMinor, minorToMajor } from './money';

async function getBaseCurrency(db: Db, tenantId: string, userId: string): Promise<string> {
  const [row] = await db
    .select({ baseCurrency: ledgerSettings.baseCurrency })
    .from(ledgerSettings)
    .where(and(eq(ledgerSettings.tenantId, tenantId), eq(ledgerSettings.userId, userId)));
  return row?.baseCurrency ?? DEFAULT_CURRENCY;
}

export interface SubcategoryOption {
  id: string;
  /** "Parent > Child" — expenses log against a subcategory, never a bare
   * top-level category (SPEC.md's ledger_transactions.category_id comment),
   * so the picker needs to show which top-level category it rolls up into. */
  label: string;
}

/** Active (non-archived) subcategories only, for the expense-entry category picker. */
export async function listSubcategoryOptions(): Promise<SubcategoryOption[]> {
  const { db, userId, tenantId } = await getContext();
  const rows = await db
    .select()
    .from(ledgerCategories)
    .where(and(eq(ledgerCategories.tenantId, tenantId), eq(ledgerCategories.userId, userId)));

  const byId = new Map(rows.map((row) => [row.id, row]));
  const options: SubcategoryOption[] = [];

  for (const row of rows) {
    if (!row.parentId || row.archived) continue;
    const parent = byId.get(row.parentId);
    if (!parent || parent.archived) continue;
    options.push({ id: row.id, label: `${parent.name} > ${row.name}` });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

export interface Transaction {
  id: string;
  categoryId: string;
  categoryLabel: string;
  date: string;
  amount: string;
  currency: string;
  note: string | null;
}

export async function listTransactions(): Promise<Transaction[]> {
  const { db, userId, tenantId } = await getContext();

  const [rows, categoryRows] = await Promise.all([
    db
      .select()
      .from(ledgerTransactions)
      .where(
        and(
          eq(ledgerTransactions.tenantId, tenantId),
          eq(ledgerTransactions.userId, userId),
          isNull(ledgerTransactions.deletedAt),
        ),
      )
      .orderBy(desc(ledgerTransactions.date), desc(ledgerTransactions.createdAt)),
    db
      .select()
      .from(ledgerCategories)
      .where(and(eq(ledgerCategories.tenantId, tenantId), eq(ledgerCategories.userId, userId))),
  ]);

  const byId = new Map(categoryRows.map((row) => [row.id, row]));

  return rows.map((row) => {
    const category = byId.get(row.categoryId);
    const parent = category?.parentId ? byId.get(category.parentId) : undefined;
    const categoryLabel = category
      ? parent
        ? `${parent.name} > ${category.name}`
        : category.name
      : 'Unknown category';

    return {
      id: row.id,
      categoryId: row.categoryId,
      categoryLabel,
      date: row.date,
      amount: minorToMajor(row.amount),
      currency: row.currency,
      note: row.note,
    };
  });
}

function parseTransactionInput(formData: FormData):
  | { categoryId: string; date: string; amount: number; note: string | null }
  | { error: string } {
  const categoryId = formString(formData, 'categoryId');
  if (!categoryId) return { error: 'Choose a subcategory.' };

  const date = formString(formData, 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Enter a valid date.' };

  const amount = majorToMinor(formString(formData, 'amount'));
  if (amount === null) return { error: 'Enter an amount greater than zero.' };

  return { categoryId, date, amount, note: formOptionalString(formData, 'note') };
}

export async function addTransaction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { db, userId, tenantId } = await getContext();

  const parsed = parseTransactionInput(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };

  const [category] = await db
    .select({ id: ledgerCategories.id, parentId: ledgerCategories.parentId })
    .from(ledgerCategories)
    .where(
      and(
        eq(ledgerCategories.id, parsed.categoryId),
        eq(ledgerCategories.tenantId, tenantId),
        eq(ledgerCategories.userId, userId),
      ),
    );
  // Expenses only ever log against a subcategory, not a top-level category
  // (SPEC.md's ledger_transactions.category_id comment) — reject a
  // tampered categoryId that points at a top-level row (parentId null).
  if (!category || !category.parentId) return { ok: false, error: 'Subcategory not found.' };

  const currency = await getBaseCurrency(db, tenantId, userId);
  const ts = now();

  try {
    // Locked/dynamic FX modes (Task 11/12) don't exist yet — every expense
    // is logged in the user's base currency with fx_mode 'base' and no rate,
    // matching the dormant-FX-column convention the schema was scaffolded
    // with (roadmap.md Task 0/"Platform gaps").
    await db.insert(ledgerTransactions).values({
      id: randomUUID(),
      tenantId,
      userId,
      categoryId: parsed.categoryId,
      date: parsed.date,
      amount: parsed.amount,
      currency,
      fxMode: 'base',
      fxRate: null,
      baseAmount: parsed.amount,
      note: parsed.note,
      source: 'manual',
      recurringId: null,
      jarId: null,
      deletedAt: null,
      createdAt: ts,
      updatedAt: ts,
    });
  } catch {
    return { ok: false, error: 'Could not log this expense. Please try again.' };
  }

  revalidatePath('/ledger/expenses');
  return { ok: true, message: 'Expense logged.' };
}

export async function updateTransaction(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { db, userId, tenantId } = await getContext();

  const id = formString(formData, 'id');
  if (!id) return { ok: false, error: 'Missing expense.' };

  const parsed = parseTransactionInput(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };

  const [category] = await db
    .select({ id: ledgerCategories.id, parentId: ledgerCategories.parentId })
    .from(ledgerCategories)
    .where(
      and(
        eq(ledgerCategories.id, parsed.categoryId),
        eq(ledgerCategories.tenantId, tenantId),
        eq(ledgerCategories.userId, userId),
      ),
    );
  if (!category || !category.parentId) return { ok: false, error: 'Subcategory not found.' };

  try {
    await db
      .update(ledgerTransactions)
      .set({
        categoryId: parsed.categoryId,
        date: parsed.date,
        amount: parsed.amount,
        baseAmount: parsed.amount,
        note: parsed.note,
        updatedAt: now(),
      })
      .where(
        and(
          eq(ledgerTransactions.id, id),
          eq(ledgerTransactions.tenantId, tenantId),
          eq(ledgerTransactions.userId, userId),
        ),
      );
  } catch {
    return { ok: false, error: 'Could not save this expense. Please try again.' };
  }

  revalidatePath('/ledger/expenses');
  return { ok: true, message: 'Expense updated.' };
}

/** LDG-08: soft delete, preferred for auditability — the row stays for any
 * future rollup/export that reads history, just excluded from live totals. */
export async function deleteTransaction(id: string): Promise<void> {
  const { db, userId, tenantId } = await getContext();
  await db
    .update(ledgerTransactions)
    .set({ deletedAt: now(), updatedAt: now() })
    .where(
      and(
        eq(ledgerTransactions.id, id),
        eq(ledgerTransactions.tenantId, tenantId),
        eq(ledgerTransactions.userId, userId),
      ),
    );
  revalidatePath('/ledger/expenses');
}
