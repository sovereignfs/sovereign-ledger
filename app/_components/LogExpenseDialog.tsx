'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button, Dialog, FormField, Input, Select } from '@sovereignfs/ui';
import type { ActionResult } from '../_lib/db';
import { addTransaction } from '../_lib/expenseActions';
import type { SubcategoryOption } from '../_lib/expenseActions';
import { todayLocalDateOnly } from '../_lib/formUtils';
import styles from './DialogForm.module.css';

export function LogExpenseDialog({ subcategories }: { subcategories: SubcategoryOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addTransaction,
    null,
  );

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  const disabled = subcategories.length === 0;

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} disabled={disabled}>
        Log expense
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title="Log expense">
        <form action={formAction} className={styles.form}>
          {state && !state.ok && (
            <p className={styles.feedbackError} role="status" aria-live="polite">
              {state.error}
            </p>
          )}
          <FormField label="Subcategory" required>
            {(field) => (
              <Select {...field} name="categoryId" required defaultValue="">
                <option value="" disabled>
                  Choose a subcategory
                </option>
                {subcategories.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Date" required>
            {(field) => (
              <Input {...field} name="date" type="date" required defaultValue={todayLocalDateOnly()} />
            )}
          </FormField>
          <FormField label="Amount" required>
            {(field) => (
              <Input {...field} name="amount" type="number" step="0.01" min="0.01" required />
            )}
          </FormField>
          <FormField label="Note">
            {(field) => <Input {...field} name="note" placeholder="Optional" />}
          </FormField>
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Logging…' : 'Log expense'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
