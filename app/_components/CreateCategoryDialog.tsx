'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button, Dialog, FormField, Input, Select } from '@sovereignfs/ui';
import { createCategory } from '../_lib/categoryActions';
import { CATEGORY_GROUPS } from '../_lib/categoryGroups';
import type { ActionResult } from '../_lib/db';
import styles from './DialogForm.module.css';

export function CreateCategoryDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createCategory,
    null,
  );

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Add category
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title="New category">
        <form action={formAction} className={styles.form}>
          {state && !state.ok && (
            <p className={styles.feedbackError} role="status" aria-live="polite">
              {state.error}
            </p>
          )}
          <FormField label="Name" required>
            {(field) => <Input {...field} name="name" required placeholder="Housing" />}
          </FormField>
          <FormField label="Group" hint="How this category's spending is tracked.">
            {(field) => (
              <Select {...field} name="group" defaultValue="dynamic">
                {CATEGORY_GROUPS.map((group) => (
                  <option key={group.value} value={group.value}>
                    {group.label}
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
              {pending ? 'Adding…' : 'Add category'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
