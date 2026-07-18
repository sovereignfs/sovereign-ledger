import Link from 'next/link';
import { EmptyState, PageHeader } from '@sovereignfs/ui';
import { BackLink } from '../_components/BackLink';
import { LogExpenseDialog } from '../_components/LogExpenseDialog';
import { TransactionList } from '../_components/TransactionList';
import { listSubcategoryOptions, listTransactions } from '../_lib/expenseActions';
import styles from './page.module.css';

export default async function ExpensesPage() {
  const [transactions, subcategories] = await Promise.all([
    listTransactions(),
    listSubcategoryOptions(),
  ]);

  return (
    <div className={styles.page}>
      <BackLink href="/ledger">Back</BackLink>

      <PageHeader
        title="Expenses"
        description="Log what you spend, day to day."
        action={<LogExpenseDialog subcategories={subcategories} />}
      />

      {subcategories.length === 0 ? (
        <EmptyState
          heading="No subcategories yet"
          description="Expenses log against a subcategory. Add one on the Categories screen first."
        />
      ) : transactions.length === 0 ? (
        <EmptyState heading="No expenses logged yet" description="Log your first expense above." />
      ) : (
        <TransactionList transactions={transactions} subcategories={subcategories} />
      )}

      {subcategories.length === 0 && (
        <Link href="/ledger/categories" className={styles.categoriesLink}>
          Go to categories
        </Link>
      )}
    </div>
  );
}
