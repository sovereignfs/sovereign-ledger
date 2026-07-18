'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button, Dialog, FormField, Input } from '@sovereignfs/ui';
import { createSubcategory } from '../_lib/categoryActions';
import type { ActionResult } from '../_lib/db';
import styles from './CategoryDialogs.module.css';

export function AddSubcategoryDialog({
  parentId,
  parentName,
}: {
  parentId: string;
  parentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createSubcategory,
    null,
  );

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Add subcategory
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={`New subcategory in ${parentName}`}
      >
        <form action={formAction} className={styles.form}>
          {state && !state.ok && (
            <p className={styles.feedbackError} role="status" aria-live="polite">
              {state.error}
            </p>
          )}
          <input type="hidden" name="parentId" value={parentId} />
          <FormField label="Name" required>
            {(field) => <Input {...field} name="name" required placeholder="Rent" />}
          </FormField>
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add subcategory'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
