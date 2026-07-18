'use client';

import { useActionState } from 'react';
import { Button, FormField, Input, Select } from '@sovereignfs/ui';
import type { SettingsData } from '../_lib/actions';
import { updateSettings } from '../_lib/actions';
import { CURRENCIES } from '../_lib/currencies';
import type { ActionResult } from '../_lib/db';
import styles from './SettingsForm.module.css';

export function SettingsForm({ settings }: { settings: SettingsData }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateSettings,
    null,
  );

  return (
    <form action={formAction} className={styles.form}>
      {state && !state.ok && (
        <p className={styles.feedbackError} role="status" aria-live="polite">
          {state.error}
        </p>
      )}
      {state && state.ok && state.message && (
        <p className={styles.feedbackSuccess} role="status" aria-live="polite">
          {state.message}
        </p>
      )}

      <div className={styles.grid}>
        <FormField
          label="Base currency"
          hint="Every budget, total, and report is calculated in this currency."
        >
          {(field) => (
            <Select {...field} name="baseCurrency" defaultValue={settings.baseCurrency}>
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          label="Display currency"
          hint="What screens show by default. Leave as base currency unless you want a different everyday view."
        >
          {(field) => (
            <Select {...field} name="displayCurrency" defaultValue={settings.displayCurrency}>
              <option value="">Same as base currency</option>
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          label="Month start day"
          hint="The day of the month your budget period begins, from 1 to 28."
        >
          {(field) => (
            <Input
              {...field}
              name="monthStartDay"
              type="number"
              min={1}
              max={28}
              defaultValue={settings.monthStartDay}
            />
          )}
        </FormField>
      </div>

      <div className={styles.actions}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </form>
  );
}
