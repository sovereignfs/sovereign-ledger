'use client';

import { useTransition } from 'react';
import { Button } from '@sovereignfs/ui';
import { deleteBudgetOverride } from '../_lib/budgetActions';

export function DeleteBudgetOverrideButton({ id, categoryId }: { id: string; categoryId: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteBudgetOverride(id, categoryId);
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleDelete}>
      Delete
    </Button>
  );
}
