'use server';

import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { ledgerBudgets, ledgerCategories, ledgerSettings } from '../_db/schema';
import { DEFAULT_CURRENCY } from './currencies';
import { type ActionResult, type Db, getContext } from './db';
import { formString, now } from './formUtils';
import { majorToMinor, minorToMajor } from './money';

export interface BudgetNode {
  id: string;
  name: string;
  group: string;
  archived: boolean;
  /** Major-unit string, e.g. "450.00" — null if no default budget is set. */
  defaultAmount: string | null;
  currency: string;
  subcategories: BudgetNode[];
}

async function getBaseCurrency(db: Db, tenantId: string, userId: string): Promise<string> {
  const [row] = await db
    .select({ baseCurrency: ledgerSettings.baseCurrency })
    .from(ledgerSettings)
    .where(and(eq(ledgerSettings.tenantId, tenantId), eq(ledgerSettings.userId, userId)));
  return row?.baseCurrency ?? DEFAULT_CURRENCY;
}

/** Category tree (mirrors categoryActions' listCategories) annotated with each
 * category's default (period = null) budget, for LDG-04's list screen. */
export async function listCategoryBudgets(): Promise<BudgetNode[]> {
  const { db, userId, tenantId } = await getContext();
  const baseCurrency = await getBaseCurrency(db, tenantId, userId);

  const [categoryRows, defaultBudgetRows] = await Promise.all([
    db
      .select()
      .from(ledgerCategories)
      .where(and(eq(ledgerCategories.tenantId, tenantId), eq(ledgerCategories.userId, userId)))
      .orderBy(asc(ledgerCategories.sortOrder)),
    db
      .select()
      .from(ledgerBudgets)
      .where(
        and(
          eq(ledgerBudgets.tenantId, tenantId),
          eq(ledgerBudgets.userId, userId),
          isNull(ledgerBudgets.period),
        ),
      ),
  ]);

  const budgetByCategory = new Map(defaultBudgetRows.map((row) => [row.categoryId, row]));

  const nodes = new Map<string, BudgetNode>(
    categoryRows.map((row) => {
      const budget = budgetByCategory.get(row.id);
      return [
        row.id,
        {
          id: row.id,
          name: row.name,
          group: row.group,
          archived: row.archived,
          defaultAmount: budget ? minorToMajor(budget.amount) : null,
          currency: budget?.currency ?? baseCurrency,
          subcategories: [],
        },
      ];
    }),
  );

  const topLevel: BudgetNode[] = [];
  for (const row of categoryRows) {
    const node = nodes.get(row.id);
    if (!node) continue;
    if (row.parentId) {
      const parent = nodes.get(row.parentId);
      if (parent) parent.subcategories.push(node);
    } else {
      topLevel.push(node);
    }
  }

  return topLevel;
}

export interface CategorySummary {
  id: string;
  name: string;
  currency: string;
}

export async function getCategorySummary(categoryId: string): Promise<CategorySummary | null> {
  const { db, userId, tenantId } = await getContext();
  const [row] = await db
    .select({ id: ledgerCategories.id, name: ledgerCategories.name })
    .from(ledgerCategories)
    .where(
      and(
        eq(ledgerCategories.id, categoryId),
        eq(ledgerCategories.tenantId, tenantId),
        eq(ledgerCategories.userId, userId),
      ),
    );
  if (!row) return null;
  return { ...row, currency: await getBaseCurrency(db, tenantId, userId) };
}

export async function setDefaultBudget(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { db, userId, tenantId } = await getContext();

  const categoryId = formString(formData, 'categoryId');
  if (!categoryId) return { ok: false, error: 'Missing category.' };

  const amount = majorToMinor(formString(formData, 'amount'));
  if (amount === null) return { ok: false, error: 'Enter an amount greater than zero.' };

  const currency = await getBaseCurrency(db, tenantId, userId);
  const ts = now();

  try {
    const [existing] = await db
      .select({ id: ledgerBudgets.id })
      .from(ledgerBudgets)
      .where(
        and(
          eq(ledgerBudgets.tenantId, tenantId),
          eq(ledgerBudgets.userId, userId),
          eq(ledgerBudgets.categoryId, categoryId),
          isNull(ledgerBudgets.period),
        ),
      );

    if (existing) {
      await db
        .update(ledgerBudgets)
        .set({ amount, currency, updatedAt: ts })
        .where(eq(ledgerBudgets.id, existing.id));
    } else {
      await db.insert(ledgerBudgets).values({
        id: randomUUID(),
        tenantId,
        userId,
        categoryId,
        period: null,
        amount,
        currency,
        createdAt: ts,
        updatedAt: ts,
      });
    }
  } catch {
    return { ok: false, error: 'Could not save this budget. Please try again.' };
  }

  revalidatePath('/ledger/budgets');
  return { ok: true, message: 'Budget saved.' };
}

export async function clearDefaultBudget(categoryId: string): Promise<void> {
  const { db, userId, tenantId } = await getContext();
  await db
    .delete(ledgerBudgets)
    .where(
      and(
        eq(ledgerBudgets.tenantId, tenantId),
        eq(ledgerBudgets.userId, userId),
        eq(ledgerBudgets.categoryId, categoryId),
        isNull(ledgerBudgets.period),
      ),
    );
  revalidatePath('/ledger/budgets');
}

export interface BudgetOverride {
  id: string;
  period: string;
  amount: string;
  currency: string;
}

export async function listBudgetOverrides(categoryId: string): Promise<BudgetOverride[]> {
  const { db, userId, tenantId } = await getContext();
  const rows = await db
    .select()
    .from(ledgerBudgets)
    .where(
      and(
        eq(ledgerBudgets.tenantId, tenantId),
        eq(ledgerBudgets.userId, userId),
        eq(ledgerBudgets.categoryId, categoryId),
      ),
    )
    .orderBy(asc(ledgerBudgets.period));

  return rows
    .filter((row): row is typeof row & { period: string } => row.period !== null)
    .map((row) => ({
      id: row.id,
      period: row.period,
      amount: minorToMajor(row.amount),
      currency: row.currency,
    }));
}

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function addBudgetOverride(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { db, userId, tenantId } = await getContext();

  const categoryId = formString(formData, 'categoryId');
  if (!categoryId) return { ok: false, error: 'Missing category.' };

  const period = formString(formData, 'period');
  if (!PERIOD_PATTERN.test(period)) return { ok: false, error: 'Choose a month.' };

  const amount = majorToMinor(formString(formData, 'amount'));
  if (amount === null) return { ok: false, error: 'Enter an amount greater than zero.' };

  const currency = await getBaseCurrency(db, tenantId, userId);
  const ts = now();

  try {
    const [existing] = await db
      .select({ id: ledgerBudgets.id })
      .from(ledgerBudgets)
      .where(
        and(
          eq(ledgerBudgets.tenantId, tenantId),
          eq(ledgerBudgets.userId, userId),
          eq(ledgerBudgets.categoryId, categoryId),
          eq(ledgerBudgets.period, period),
        ),
      );

    if (existing) {
      await db
        .update(ledgerBudgets)
        .set({ amount, currency, updatedAt: ts })
        .where(eq(ledgerBudgets.id, existing.id));
    } else {
      await db.insert(ledgerBudgets).values({
        id: randomUUID(),
        tenantId,
        userId,
        categoryId,
        period,
        amount,
        currency,
        createdAt: ts,
        updatedAt: ts,
      });
    }
  } catch {
    return { ok: false, error: 'Could not save this override. Please try again.' };
  }

  revalidatePath(`/ledger/budgets/${categoryId}`);
  return { ok: true, message: 'Override saved.' };
}

export async function deleteBudgetOverride(id: string, categoryId: string): Promise<void> {
  const { db, userId, tenantId } = await getContext();
  await db
    .delete(ledgerBudgets)
    .where(
      and(
        eq(ledgerBudgets.id, id),
        eq(ledgerBudgets.tenantId, tenantId),
        eq(ledgerBudgets.userId, userId),
      ),
    );
  revalidatePath(`/ledger/budgets/${categoryId}`);
}
