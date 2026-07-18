import { notFound } from 'next/navigation';
import { Card, EmptyState, PageHeader } from '@sovereignfs/ui';
import { AddBudgetOverrideDialog } from '../../_components/AddBudgetOverrideDialog';
import { BackLink } from '../../_components/BackLink';
import { DeleteBudgetOverrideButton } from '../../_components/DeleteBudgetOverrideButton';
import { getCategorySummary, listBudgetOverrides } from '../../_lib/budgetActions';
import styles from './page.module.css';

export default async function BudgetOverridesPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const category = await getCategorySummary(categoryId);
  if (!category) notFound();

  const overrides = await listBudgetOverrides(categoryId);

  return (
    <div className={styles.page}>
      <BackLink href="/ledger/budgets">Back</BackLink>

      <PageHeader
        title={`${category.name} — month overrides`}
        description="Set a different budget amount for a specific month. Every other month uses the default."
        action={<AddBudgetOverrideDialog categoryId={categoryId} currency={category.currency} />}
      />

      {overrides.length === 0 ? (
        <EmptyState
          heading="No overrides yet"
          description="This category uses its default budget every month."
        />
      ) : (
        <Card className={styles.card}>
          <ul className={styles.list}>
            {overrides.map((override) => (
              <li key={override.id} className={styles.row}>
                <span className={styles.period}>{override.period}</span>
                <span className={styles.amount}>
                  {override.currency} {override.amount}
                </span>
                <DeleteBudgetOverrideButton id={override.id} categoryId={categoryId} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
