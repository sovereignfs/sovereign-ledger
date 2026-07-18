'use server';

import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { ledgerIncomeEntries, ledgerIncomeSources } from '../_db/schema';
import { CURRENCY_CODES } from './currencies';
import { type ActionResult, getContext } from './db';
import { formOptionalString, formString, now } from './formUtils';
import { majorToMinor, minorToMajor } from './money';

const INCOME_KINDS = new Set(['fixed', 'dynamic']);
const INCOME_CADENCES = new Set(['monthly', 'yearly', 'adhoc']);

export interface IncomeSource {
  id: string;
  name: string;
  kind: string;
  expectedAmount: string;
  currency: string;
  cadence: string;
  active: boolean;
}

export async function listIncomeSources(): Promise<IncomeSource[]> {
  const { db, userId, tenantId } = await getContext();
  const rows = await db
    .select()
    .from(ledgerIncomeSources)
    .where(and(eq(ledgerIncomeSources.tenantId, tenantId), eq(ledgerIncomeSources.userId, userId)))
    .orderBy(asc(ledgerIncomeSources.sortOrder));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    expectedAmount: minorToMajor(row.expectedAmount),
    currency: row.currency,
    cadence: row.cadence,
    active: row.active,
  }));
}

export async function getIncomeSource(id: string): Promise<IncomeSource | null> {
  const { db, userId, tenantId } = await getContext();
  const [row] = await db
    .select()
    .from(ledgerIncomeSources)
    .where(
      and(
        eq(ledgerIncomeSources.id, id),
        eq(ledgerIncomeSources.tenantId, tenantId),
        eq(ledgerIncomeSources.userId, userId),
      ),
    );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    expectedAmount: minorToMajor(row.expectedAmount),
    currency: row.currency,
    cadence: row.cadence,
    active: row.active,
  };
}

function parseSourceInput(formData: FormData):
  | {
      name: string;
      kind: string;
      expectedAmount: number;
      currency: string;
      cadence: string;
    }
  | { error: string } {
  const name = formString(formData, 'name');
  if (!name) return { error: 'Enter a name.' };

  const kind = formString(formData, 'kind');
  if (!INCOME_KINDS.has(kind)) return { error: 'Choose a kind.' };

  const expectedAmount = majorToMinor(formString(formData, 'expectedAmount'));
  if (expectedAmount === null) return { error: 'Enter an expected amount greater than zero.' };

  const currency = formString(formData, 'currency');
  if (!CURRENCY_CODES.has(currency)) return { error: 'Choose a currency.' };

  const cadence = formString(formData, 'cadence');
  if (!INCOME_CADENCES.has(cadence)) return { error: 'Choose a cadence.' };

  return { name, kind, expectedAmount, currency, cadence };
}

export async function createIncomeSource(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { db, userId, tenantId } = await getContext();

  const parsed = parseSourceInput(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };

  const ts = now();
  try {
    await db.insert(ledgerIncomeSources).values({
      id: randomUUID(),
      tenantId,
      userId,
      ...parsed,
      active: true,
      sortOrder: 0,
      createdAt: ts,
      updatedAt: ts,
    });
  } catch {
    return { ok: false, error: 'Could not create this income source. Please try again.' };
  }

  revalidatePath('/ledger/income');
  return { ok: true, message: 'Income source added.' };
}

export async function updateIncomeSource(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { db, userId, tenantId } = await getContext();

  const id = formString(formData, 'id');
  if (!id) return { ok: false, error: 'Missing income source.' };

  const parsed = parseSourceInput(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };

  try {
    await db
      .update(ledgerIncomeSources)
      .set({ ...parsed, updatedAt: now() })
      .where(
        and(
          eq(ledgerIncomeSources.id, id),
          eq(ledgerIncomeSources.tenantId, tenantId),
          eq(ledgerIncomeSources.userId, userId),
        ),
      );
  } catch {
    return { ok: false, error: 'Could not save this income source. Please try again.' };
  }

  revalidatePath('/ledger/income');
  revalidatePath(`/ledger/income/${id}`);
  return { ok: true, message: 'Income source saved.' };
}

export async function setIncomeSourceActive(id: string, active: boolean): Promise<void> {
  const { db, userId, tenantId } = await getContext();
  await db
    .update(ledgerIncomeSources)
    .set({ active, updatedAt: now() })
    .where(
      and(
        eq(ledgerIncomeSources.id, id),
        eq(ledgerIncomeSources.tenantId, tenantId),
        eq(ledgerIncomeSources.userId, userId),
      ),
    );
  revalidatePath('/ledger/income');
}

export interface IncomeEntry {
  id: string;
  period: string;
  amount: string;
  currency: string;
  note: string | null;
}

export async function listIncomeEntries(sourceId: string): Promise<IncomeEntry[]> {
  const { db, userId, tenantId } = await getContext();
  const rows = await db
    .select()
    .from(ledgerIncomeEntries)
    .where(
      and(
        eq(ledgerIncomeEntries.tenantId, tenantId),
        eq(ledgerIncomeEntries.userId, userId),
        eq(ledgerIncomeEntries.sourceId, sourceId),
      ),
    )
    .orderBy(desc(ledgerIncomeEntries.period));

  return rows.map((row) => ({
    id: row.id,
    period: row.period,
    amount: minorToMajor(row.amount),
    currency: row.currency,
    note: row.note,
  }));
}

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function addIncomeEntry(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { db, userId, tenantId } = await getContext();

  const sourceId = formString(formData, 'sourceId');
  if (!sourceId) return { ok: false, error: 'Missing income source.' };

  const period = formString(formData, 'period');
  if (!PERIOD_PATTERN.test(period)) return { ok: false, error: 'Choose a month.' };

  const amount = majorToMinor(formString(formData, 'amount'));
  if (amount === null) return { ok: false, error: 'Enter an amount greater than zero.' };

  const [source] = await db
    .select({ currency: ledgerIncomeSources.currency })
    .from(ledgerIncomeSources)
    .where(
      and(
        eq(ledgerIncomeSources.id, sourceId),
        eq(ledgerIncomeSources.tenantId, tenantId),
        eq(ledgerIncomeSources.userId, userId),
      ),
    );
  if (!source) return { ok: false, error: 'Income source not found.' };

  const note = formOptionalString(formData, 'note');
  const ts = now();

  try {
    // Live FX conversion (Task 10-13) doesn't exist yet — every entry is
    // recorded as its own base amount with fx_rate '1', matching the
    // dormant-FX-column convention the whole schema was scaffolded with
    // (roadmap.md Task 0/"Platform gaps"). Multi-currency income correctly
    // reflecting base-currency totals lands with Task 10.
    await db.insert(ledgerIncomeEntries).values({
      id: randomUUID(),
      tenantId,
      userId,
      sourceId,
      period,
      amount,
      currency: source.currency,
      fxRate: '1',
      baseAmount: amount,
      note,
      createdAt: ts,
      updatedAt: ts,
    });
  } catch {
    return { ok: false, error: 'Could not save this entry. Please try again.' };
  }

  revalidatePath(`/ledger/income/${sourceId}`);
  return { ok: true, message: 'Income entry added.' };
}

export async function deleteIncomeEntry(id: string, sourceId: string): Promise<void> {
  const { db, userId, tenantId } = await getContext();
  await db
    .delete(ledgerIncomeEntries)
    .where(
      and(
        eq(ledgerIncomeEntries.id, id),
        eq(ledgerIncomeEntries.tenantId, tenantId),
        eq(ledgerIncomeEntries.userId, userId),
      ),
    );
  revalidatePath(`/ledger/income/${sourceId}`);
}
