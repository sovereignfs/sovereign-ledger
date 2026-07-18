'use client';

import { useActionState, useTransition } from 'react';
import { Button, Input } from '@sovereignfs/ui';
import { clearDefaultBudget, setDefaultBudget } from '../_lib/budgetActions';
import type { ActionResult } from '../_lib/db';
import styles from './DefaultBudgetForm.module.css';

export function DefaultBudgetForm({
  categoryId,
  amount,
  currency,
}: {
  categoryId: string;
  amount: string | null;
  currency: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    setDefaultBudget,
    null,
  );
  const [clearing, startClear] = useTransition();

  return (
    <div className={styles.wrapper}>
      <form action={formAction} className={styles.form}>
        <input type="hidden" name="categoryId" value={categoryId} />
        <span className={styles.currency}>{currency}</span>
        <Input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={amount ?? ''}
          placeholder="0.00"
          className={styles.amountInput}
          aria-label="Default monthly budget"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {amount !== null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={clearing}
            onClick={() => startClear(() => clearDefaultBudget(categoryId))}
          >
            Clear
          </Button>
        )}
      </form>
      {state && !state.ok && (
        <p className={styles.feedbackError} role="status" aria-live="polite">
          {state.error}
        </p>
      )}
    </div>
  );
}
