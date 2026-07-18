'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button, Dialog, FormField, Input } from '@sovereignfs/ui';
import type { ActionResult } from '../_lib/db';
import { addIncomeEntry } from '../_lib/incomeActions';
import styles from './DialogForm.module.css';

export function AddIncomeEntryDialog({
  sourceId,
  currency,
}: {
  sourceId: string;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addIncomeEntry,
    null,
  );

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Record income
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title="Record income">
        <form action={formAction} className={styles.form}>
          {state && !state.ok && (
            <p className={styles.feedbackError} role="status" aria-live="polite">
              {state.error}
            </p>
          )}
          <input type="hidden" name="sourceId" value={sourceId} />
          <FormField label="Month" required>
            {(field) => <Input {...field} name="period" type="month" required />}
          </FormField>
          <FormField label={`Amount (${currency})`} required>
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
              {pending ? 'Saving…' : 'Save entry'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
