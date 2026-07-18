'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button, Dialog, FormField, Input, Select } from '@sovereignfs/ui';
import { CURRENCIES } from '../_lib/currencies';
import type { ActionResult } from '../_lib/db';
import type { IncomeSource } from '../_lib/incomeActions';
import { updateIncomeSource } from '../_lib/incomeActions';
import { INCOME_CADENCE_OPTIONS, INCOME_KIND_OPTIONS } from '../_lib/incomeOptions';
import styles from './DialogForm.module.css';

export function EditIncomeSourceDialog({ source }: { source: IncomeSource }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateIncomeSource,
    null,
  );

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title="Edit income source">
        <form action={formAction} className={styles.form}>
          {state && !state.ok && (
            <p className={styles.feedbackError} role="status" aria-live="polite">
              {state.error}
            </p>
          )}
          <input type="hidden" name="id" value={source.id} />
          <FormField label="Name" required>
            {(field) => <Input {...field} name="name" required defaultValue={source.name} />}
          </FormField>
          <FormField label="Kind">
            {(field) => (
              <Select {...field} name="kind" defaultValue={source.kind}>
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
              <Input
                {...field}
                name="expectedAmount"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={source.expectedAmount}
              />
            )}
          </FormField>
          <FormField label="Currency">
            {(field) => (
              <Select {...field} name="currency" defaultValue={source.currency}>
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
              <Select {...field} name="cadence" defaultValue={source.cadence}>
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
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
