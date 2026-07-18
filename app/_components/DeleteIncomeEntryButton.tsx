'use client';

import { useTransition } from 'react';
import { Button } from '@sovereignfs/ui';
import { deleteIncomeEntry } from '../_lib/incomeActions';

export function DeleteIncomeEntryButton({ id, sourceId }: { id: string; sourceId: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteIncomeEntry(id, sourceId);
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleDelete}>
      Delete
    </Button>
  );
}
