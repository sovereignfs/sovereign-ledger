'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button, Dialog, FormField, Input } from '@sovereignfs/ui';
import { renameCategory } from '../_lib/categoryActions';
import type { ActionResult } from '../_lib/db';
import styles from './DialogForm.module.css';

export function RenameCategoryDialog({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    renameCategory,
    null,
  );

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Rename
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title="Rename">
        <form action={formAction} className={styles.form}>
          {state && !state.ok && (
            <p className={styles.feedbackError} role="status" aria-live="polite">
              {state.error}
            </p>
          )}
          <input type="hidden" name="id" value={id} />
          <FormField label="Name" required>
            {(field) => <Input {...field} name="name" required defaultValue={name} />}
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
