'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button, Dialog, FormField, Input, Select } from '@sovereignfs/ui';
import type { ActionResult } from '../_lib/db';
import type { SubcategoryOption, Transaction } from '../_lib/expenseActions';
import { updateTransaction } from '../_lib/expenseActions';
import styles from './DialogForm.module.css';

export function EditTransactionDialog({
  transaction,
  subcategories,
}: {
  transaction: Transaction;
  subcategories: SubcategoryOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateTransaction,
    null,
  );

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  // The transaction's current category might have been archived since it
  // was logged — still offer it in the picker (labeled from the row itself)
  // so editing an old expense doesn't force a re-categorization.
  const options = subcategories.some((option) => option.id === transaction.categoryId)
    ? subcategories
    : [{ id: transaction.categoryId, label: `${transaction.categoryLabel} (archived)` }, ...subcategories];

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title="Edit expense">
        <form action={formAction} className={styles.form}>
          {state && !state.ok && (
            <p className={styles.feedbackError} role="status" aria-live="polite">
              {state.error}
            </p>
          )}
          <input type="hidden" name="id" value={transaction.id} />
          <FormField label="Subcategory" required>
            {(field) => (
              <Select {...field} name="categoryId" required defaultValue={transaction.categoryId}>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Date" required>
            {(field) => <Input {...field} name="date" type="date" required defaultValue={transaction.date} />}
          </FormField>
          <FormField label="Amount" required>
            {(field) => (
              <Input
                {...field}
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={transaction.amount}
              />
            )}
          </FormField>
          <FormField label="Note">
            {(field) => (
              <Input {...field} name="note" placeholder="Optional" defaultValue={transaction.note ?? ''} />
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
