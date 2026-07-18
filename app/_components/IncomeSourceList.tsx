import Link from 'next/link';
import { Badge, Card } from '@sovereignfs/ui';
import type { IncomeSource } from '../_lib/incomeActions';
import { incomeCadenceLabel, incomeKindLabel } from '../_lib/incomeOptions';
import { EditIncomeSourceDialog } from './EditIncomeSourceDialog';
import styles from './IncomeSourceList.module.css';
import { ToggleIncomeSourceActiveButton } from './ToggleIncomeSourceActiveButton';

export function IncomeSourceList({ sources }: { sources: IncomeSource[] }) {
  return (
    <div className={styles.list}>
      {sources.map((source) => (
        <Card key={source.id} className={styles.card}>
          <div className={styles.header}>
            <div className={styles.titleRow}>
              <span className={source.active ? styles.name : styles.nameArchived}>
                {source.name}
              </span>
              <Badge variant="role">{incomeKindLabel(source.kind)}</Badge>
              <Badge variant="role">{incomeCadenceLabel(source.cadence)}</Badge>
              {!source.active && (
                <Badge variant="status" status="deactivated">
                  Archived
                </Badge>
              )}
            </div>
            <p className={styles.amount}>
              Expected {source.currency} {source.expectedAmount}
            </p>
          </div>
          <div className={styles.actions}>
            <Link href={`/ledger/income/${source.id}`} className={styles.entriesLink}>
              Income entries
            </Link>
            <EditIncomeSourceDialog source={source} />
            <ToggleIncomeSourceActiveButton id={source.id} active={source.active} />
          </div>
        </Card>
      ))}
    </div>
  );
}
