'use client';

import { useTransition } from 'react';
import { Button } from '@sovereignfs/ui';
import { deleteTransaction } from '../_lib/expenseActions';

export function DeleteTransactionButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteTransaction(id);
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleDelete}>
      Delete
    </Button>
  );
}
