import { notFound } from 'next/navigation';
import { Card, EmptyState, PageHeader } from '@sovereignfs/ui';
import { AddIncomeEntryDialog } from '../../_components/AddIncomeEntryDialog';
import { BackLink } from '../../_components/BackLink';
import { DeleteIncomeEntryButton } from '../../_components/DeleteIncomeEntryButton';
import { getIncomeSource, listIncomeEntries } from '../../_lib/incomeActions';
import styles from './page.module.css';

export default async function IncomeEntriesPage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;
  const source = await getIncomeSource(sourceId);
  if (!source) notFound();

  const entries = await listIncomeEntries(sourceId);

  return (
    <div className={styles.page}>
      <BackLink href="/ledger/income">Back</BackLink>

      <PageHeader
        title={`${source.name} — income entries`}
        description="Actual amounts recorded against this source, by month."
        action={<AddIncomeEntryDialog sourceId={sourceId} currency={source.currency} />}
      />

      {entries.length === 0 ? (
        <EmptyState
          heading="No income recorded yet"
          description="Record what you actually received for a month."
        />
      ) : (
        <Card className={styles.card}>
          <ul className={styles.list}>
            {entries.map((entry) => (
              <li key={entry.id} className={styles.row}>
                <span className={styles.period}>{entry.period}</span>
                <span className={styles.amount}>
                  {entry.currency} {entry.amount}
                </span>
                {entry.note && <span className={styles.note}>{entry.note}</span>}
                <DeleteIncomeEntryButton id={entry.id} sourceId={sourceId} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
