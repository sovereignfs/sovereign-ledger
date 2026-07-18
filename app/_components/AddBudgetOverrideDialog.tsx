'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button, Dialog, FormField, Input } from '@sovereignfs/ui';
import { addBudgetOverride } from '../_lib/budgetActions';
import type { ActionResult } from '../_lib/db';
import styles from './DialogForm.module.css';

export function AddBudgetOverrideDialog({
  categoryId,
  currency,
}: {
  categoryId: string;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addBudgetOverride,
    null,
  );

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Add override
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title="New month override">
        <form action={formAction} className={styles.form}>
          {state && !state.ok && (
            <p className={styles.feedbackError} role="status" aria-live="polite">
              {state.error}
            </p>
          )}
          <input type="hidden" name="categoryId" value={categoryId} />
          <FormField label="Month" required>
            {(field) => <Input {...field} name="period" type="month" required />}
          </FormField>
          <FormField label={`Amount (${currency})`} required>
            {(field) => (
              <Input {...field} name="amount" type="number" step="0.01" min="0.01" required />
            )}
          </FormField>
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save override'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
