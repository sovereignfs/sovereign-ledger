'use client';

import { useTransition } from 'react';
import { Button } from '@sovereignfs/ui';
import { setCategoryArchived } from '../_lib/categoryActions';

export function ToggleCategoryArchivedButton({
  id,
  archived,
}: {
  id: string;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await setCategoryArchived(id, !archived);
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={pending}
      aria-pressed={archived}
    >
      {archived ? 'Unarchive' : 'Archive'}
    </Button>
  );
}
