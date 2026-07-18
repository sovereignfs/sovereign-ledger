import { EmptyState, PageHeader } from '@sovereignfs/ui';
import { BackLink } from '../_components/BackLink';
import { BudgetTreeView } from '../_components/BudgetTreeView';
import { listCategoryBudgets } from '../_lib/budgetActions';
import styles from './page.module.css';

export default async function BudgetsPage() {
  const categories = await listCategoryBudgets();

  return (
    <div className={styles.page}>
      <BackLink href="/ledger">Back</BackLink>

      <PageHeader
        title="Budgets"
        description="Set a default monthly amount per category, with optional overrides for specific months."
      />

      {categories.length === 0 ? (
        <EmptyState
          heading="No categories yet"
          description="Add a category on the Categories screen first, then come back here to set a budget for it."
        />
      ) : (
        <BudgetTreeView categories={categories} />
      )}
    </div>
  );
}
