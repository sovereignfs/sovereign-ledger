import { EmptyState, PageHeader } from '@sovereignfs/ui';
import { BackLink } from '../_components/BackLink';
import { CreateIncomeSourceDialog } from '../_components/CreateIncomeSourceDialog';
import { IncomeSourceList } from '../_components/IncomeSourceList';
import { listIncomeSources } from '../_lib/incomeActions';
import styles from './page.module.css';

export default async function IncomePage() {
  const sources = await listIncomeSources();

  return (
    <div className={styles.page}>
      <BackLink href="/ledger">Back</BackLink>

      <PageHeader
        title="Income"
        description="Sources of income and the actual amounts you've received."
        action={<CreateIncomeSourceDialog />}
      />

      {sources.length === 0 ? (
        <EmptyState
          heading="No income sources yet"
          description="Add a source — Salary, Freelance, Rental income — to start recording what you actually receive."
        />
      ) : (
        <IncomeSourceList sources={sources} />
      )}
    </div>
  );
}
