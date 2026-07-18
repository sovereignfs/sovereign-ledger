import { and, eq, gte, isNull, lte } from 'drizzle-orm';
import {
  ledgerBudgets,
  ledgerCategories,
  ledgerIncomeEntries,
  ledgerSettings,
  ledgerTransactions,
} from '../_db/schema';
import { DEFAULT_CURRENCY } from './currencies';
import { getContext } from './db';
import { minorToMajor } from './money';

/**
 * Period bucketing. `month_start_day` (Task 1) isn't applied here — none of
 * Tasks 3/4 (budgets, income entries) offset their own 'YYYY-MM' periods by
 * it either, so treating a period as a plain calendar month keeps this
 * screen consistent with the data they already wrote rather than
 * introducing a new, unverified offset scheme just for the overview.
 */
function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function periodDateRange(period: string): { start: string; end: string } {
  const [yearStr, monthStr] = period.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const start = `${period}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${period}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export function shiftPeriod(period: string, delta: number): string {
  const [yearStr, monthStr] = period.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1 + delta;
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export interface CategoryVarianceRow {
  categoryId: string;
  label: string;
  group: string;
  /** Major-unit string, or null when no budget (default or override) is set. */
  budgeted: string | null;
  actual: string;
  /** budgeted - actual, major-unit string; null when no budget is set. */
  variance: string | null;
}

export interface MonthlyOverview {
  period: string;
  currency: string;
  totalIncome: string;
  totalExpenses: string;
  expensesByGroup: { dynamic: string; fixedMonthly: string; fixedYearly: string };
  /** income - expenses. Doesn't yet net out jar contributions (Task 7-9 —
   * jars don't exist yet); see roadmap.md "Platform gaps". */
  savings: string;
  /** Sum of every category/subcategory's applicable budget for the period
   * (override if set, else default) minus total expenses — "how much of
   * this month's plan is left," distinct from savings (income vs. spend). */
  balance: string;
  categoryVariance: CategoryVarianceRow[];
}

export async function getMonthlyOverview(period?: string): Promise<MonthlyOverview> {
  const { db, userId, tenantId } = await getContext();
  const resolvedPeriod = period ?? currentPeriod();
  const { start, end } = periodDateRange(resolvedPeriod);

  const [settingsRow, incomeRows, transactionRows, categoryRows, budgetRows] = await Promise.all([
    db
      .select({ baseCurrency: ledgerSettings.baseCurrency })
      .from(ledgerSettings)
      .where(and(eq(ledgerSettings.tenantId, tenantId), eq(ledgerSettings.userId, userId))),
    db
      .select()
      .from(ledgerIncomeEntries)
      .where(
        and(
          eq(ledgerIncomeEntries.tenantId, tenantId),
          eq(ledgerIncomeEntries.userId, userId),
          eq(ledgerIncomeEntries.period, resolvedPeriod),
        ),
      ),
    db
      .select()
      .from(ledgerTransactions)
      .where(
        and(
          eq(ledgerTransactions.tenantId, tenantId),
          eq(ledgerTransactions.userId, userId),
          isNull(ledgerTransactions.deletedAt),
          gte(ledgerTransactions.date, start),
          lte(ledgerTransactions.date, end),
        ),
      ),
    db
      .select()
      .from(ledgerCategories)
      .where(and(eq(ledgerCategories.tenantId, tenantId), eq(ledgerCategories.userId, userId))),
    db
      .select()
      .from(ledgerBudgets)
      .where(and(eq(ledgerBudgets.tenantId, tenantId), eq(ledgerBudgets.userId, userId))),
  ]);

  const currency = settingsRow[0]?.baseCurrency ?? DEFAULT_CURRENCY;
  const categoryById = new Map(categoryRows.map((row) => [row.id, row]));

  const totalIncomeMinor = incomeRows.reduce((sum, row) => sum + row.baseAmount, 0);

  const actualByCategory = new Map<string, number>();
  const expensesByGroupMinor = { dynamic: 0, fixed_monthly: 0, fixed_yearly: 0 };
  for (const row of transactionRows) {
    actualByCategory.set(row.categoryId, (actualByCategory.get(row.categoryId) ?? 0) + row.baseAmount);
    const category = categoryById.get(row.categoryId);
    const group = (category?.group ?? 'dynamic') as keyof typeof expensesByGroupMinor;
    if (group in expensesByGroupMinor) expensesByGroupMinor[group] += row.baseAmount;
  }
  const totalExpensesMinor =
    expensesByGroupMinor.dynamic + expensesByGroupMinor.fixed_monthly + expensesByGroupMinor.fixed_yearly;

  // Budget-vs-actual only for subcategories — expenses always log against a
  // subcategory (Task 5), so a top-level category used without any
  // subcategory of its own can never accumulate actual spend and would only
  // ever show a misleading "0 actual" row here.
  const defaultBudgetByCategory = new Map<string, (typeof budgetRows)[number]>();
  const overrideBudgetByCategory = new Map<string, (typeof budgetRows)[number]>();
  for (const row of budgetRows) {
    if (row.period === null) defaultBudgetByCategory.set(row.categoryId, row);
    else if (row.period === resolvedPeriod) overrideBudgetByCategory.set(row.categoryId, row);
  }

  let totalBudgetedMinor = 0;
  const categoryVariance: CategoryVarianceRow[] = [];
  for (const category of categoryRows) {
    if (!category.parentId || category.archived) continue;
    const parent = categoryById.get(category.parentId);
    const applicable = overrideBudgetByCategory.get(category.id) ?? defaultBudgetByCategory.get(category.id);
    const actualMinor = actualByCategory.get(category.id) ?? 0;

    if (applicable) totalBudgetedMinor += applicable.amount;

    categoryVariance.push({
      categoryId: category.id,
      label: parent ? `${parent.name} > ${category.name}` : category.name,
      group: category.group,
      budgeted: applicable ? minorToMajor(applicable.amount) : null,
      actual: minorToMajor(actualMinor),
      variance: applicable ? minorToMajor(applicable.amount - actualMinor) : null,
    });
  }
  categoryVariance.sort((a, b) => a.label.localeCompare(b.label));

  return {
    period: resolvedPeriod,
    currency,
    totalIncome: minorToMajor(totalIncomeMinor),
    totalExpenses: minorToMajor(totalExpensesMinor),
    expensesByGroup: {
      dynamic: minorToMajor(expensesByGroupMinor.dynamic),
      fixedMonthly: minorToMajor(expensesByGroupMinor.fixed_monthly),
      fixedYearly: minorToMajor(expensesByGroupMinor.fixed_yearly),
    },
    savings: minorToMajor(totalIncomeMinor - totalExpensesMinor),
    balance: minorToMajor(totalBudgetedMinor - totalExpensesMinor),
    categoryVariance,
  };
}
