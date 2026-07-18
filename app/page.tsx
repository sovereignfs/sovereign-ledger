import Link from 'next/link';
import { Card, PageHeader } from '@sovereignfs/ui';
import styles from './page.module.css';

export default function LedgerIndexPage() {
  return (
    <div className={styles.page}>
      <PageHeader
        title="Ledger"
        description="Budget, expenses, and jars are on the way — see roadmap.md."
      />

      <section className={styles.categoryGrid} aria-label="Ledger sections">
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
