'use server';

import { and, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { revalidatePath } from 'next/cache';
import { sdk } from '@sovereignfs/sdk';
import { ledgerSettings } from '../_db/schema';
import { CURRENCY_CODES, DEFAULT_CURRENCY } from './currencies';
import { formOptionalString, formString, now } from './formUtils';

// DrizzleClient is typed as `unknown` in the SDK (dialect-agnostic contract).
// We cast to the SQLite type here since this plugin's manifest resolves to SQLite only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BaseSQLiteDatabase<'async', any, any>;

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function getContext() {
  const session = await sdk.auth.requireSession();
  const db = (await sdk.db.getClient()) as Db;
  return { db, userId: session.user.id, tenantId: session.user.tenantId };
}

export interface SettingsData {
  baseCurrency: string;
  /** Empty string means "same as base currency" (stored as `null`). */
  displayCurrency: string;
  monthStartDay: number;
}

const DEFAULT_SETTINGS: SettingsData = {
  baseCurrency: DEFAULT_CURRENCY,
  displayCurrency: '',
  monthStartDay: 1,
};

export async function getSettings(): Promise<SettingsData> {
  const { db, userId, tenantId } = await getContext();
  const [row] = await db
    .select()
    .from(ledgerSettings)
    .where(and(eq(ledgerSettings.tenantId, tenantId), eq(ledgerSettings.userId, userId)));

  if (!row) return DEFAULT_SETTINGS;

  return {
    baseCurrency: row.baseCurrency,
    displayCurrency: row.displayCurrency ?? '',
    monthStartDay: row.monthStartDay,
  };
}

export async function updateSettings(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { db, userId, tenantId } = await getContext();

  const baseCurrency = formString(formData, 'baseCurrency');
  if (!CURRENCY_CODES.has(baseCurrency)) {
    return { ok: false, error: 'Choose a base currency.' };
  }

  const displayCurrencyRaw = formOptionalString(formData, 'displayCurrency');
  if (displayCurrencyRaw && !CURRENCY_CODES.has(displayCurrencyRaw)) {
    return { ok: false, error: 'Choose a valid display currency.' };
  }
  // Storing the base currency's own code as displayCurrency would just mean
  // "same as base" redundantly — normalize to null, matching the schema's
  // "defaults to base_currency when unset" contract.
  const displayCurrency = displayCurrencyRaw === baseCurrency ? null : displayCurrencyRaw;

  const monthStartDayRaw = formString(formData, 'monthStartDay');
  const monthStartDay = Number(monthStartDayRaw);
  if (!Number.isInteger(monthStartDay) || monthStartDay < 1 || monthStartDay > 28) {
    return { ok: false, error: 'Month start day must be a whole number between 1 and 28.' };
  }

  const ts = now();
  const values = {
    tenantId,
    userId,
    baseCurrency,
    displayCurrency,
    monthStartDay,
    updatedAt: ts,
  };

  try {
    await db
      .insert(ledgerSettings)
      .values({ ...values, createdAt: ts })
      .onConflictDoUpdate({
        target: [ledgerSettings.tenantId, ledgerSettings.userId],
        set: values,
      });
  } catch {
    return { ok: false, error: 'Could not save your settings. Please try again.' };
  }

  revalidatePath('/ledger/settings');
  return { ok: true, message: 'Settings saved.' };
}
