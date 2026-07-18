import Link from 'next/link';
import { Card, PageHeader } from '@sovereignfs/ui';
import { MonthlyOverview } from './_components/MonthlyOverview';
import { getMonthlyOverview } from './_lib/overviewActions';
import styles from './page.module.css';

export default async function LedgerIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const overview = await getMonthlyOverview(period);

  return (
    <div className={styles.page}>
      <PageHeader title="Ledger" description="Your monthly budget, at a glance." />

      <MonthlyOverview overview={overview} />

      <section className={styles.categoryGrid} aria-label="Ledger sections">
        <Link href="/ledger/categories" className={styles.categoryLink}>
          <Card interactive className={styles.categoryCard}>
            <h2 className={styles.categoryTitle}>Categories</h2>
            <p className={styles.categoryDescription}>
              Group your spending into categories and subcategories.
            </p>
          </Card>
        </Link>
        <Link href="/ledger/budgets" className={styles.categoryLink}>
          <Card interactive className={styles.categoryCard}>
            <h2 className={styles.categoryTitle}>Budgets</h2>
            <p className={styles.categoryDescription}>
              Set a default monthly amount per category, with overrides.
            </p>
          </Card>
        </Link>
        <Link href="/ledger/income" className={styles.categoryLink}>
          <Card interactive className={styles.categoryCard}>
            <h2 className={styles.categoryTitle}>Income</h2>
            <p className={styles.categoryDescription}>
              Income sources and the actual amounts you've received.
            </p>
          </Card>
        </Link>
        <Link href="/ledger/expenses" className={styles.categoryLink}>
          <Card interactive className={styles.categoryCard}>
            <h2 className={styles.categoryTitle}>Expenses</h2>
            <p className={styles.categoryDescription}>Log what you spend, day to day.</p>
          </Card>
        </Link>
        <Link href="/ledger/settings" className={styles.categoryLink}>
          <Card interactive className={styles.categoryCard}>
            <h2 className={styles.categoryTitle}>Settings</h2>
            <p className={styles.categoryDescription}>
              Base currency, display currency, and month-start day.
            </p>
          </Card>
        </Link>
      </section>
    </div>
  );
}
