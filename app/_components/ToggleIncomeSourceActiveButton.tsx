'use client';

import { useTransition } from 'react';
import { Button } from '@sovereignfs/ui';
import { setIncomeSourceActive } from '../_lib/incomeActions';

export function ToggleIncomeSourceActiveButton({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await setIncomeSourceActive(id, !active);
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={pending}
      aria-pressed={!active}
    >
      {active ? 'Archive' : 'Unarchive'}
    </Button>
  );
}
