'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button, Dialog, FormField, Input, Select } from '@sovereignfs/ui';
import { CURRENCIES, DEFAULT_CURRENCY } from '../_lib/currencies';
import type { ActionResult } from '../_lib/db';
import { createIncomeSource } from '../_lib/incomeActions';
import { INCOME_CADENCE_OPTIONS, INCOME_KIND_OPTIONS } from '../_lib/incomeOptions';
import styles from './DialogForm.module.css';

export function CreateIncomeSourceDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createIncomeSource,
    null,
  );

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Add income source
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title="New income source">
        <form action={formAction} className={styles.form}>
          {state && !state.ok && (
            <p className={styles.feedbackError} role="status" aria-live="polite">
              {state.error}
            </p>
          )}
          <FormField label="Name" required>
            {(field) => <Input {...field} name="name" required placeholder="Salary" />}
          </FormField>
          <FormField label="Kind">
            {(field) => (
              <Select {...field} name="kind" defaultValue="fixed">
                {INCOME_KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Expected amount" required>
            {(field) => (
              <Input {...field} name="expectedAmount" type="number" step="0.01" min="0.01" required />
            )}
          </FormField>
          <FormField label="Currency">
            {(field) => (
              <Select {...field} name="currency" defaultValue={DEFAULT_CURRENCY}>
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} — {currency.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Cadence">
            {(field) => (
              <Select {...field} name="cadence" defaultValue="monthly">
                {INCOME_CADENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add source'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
