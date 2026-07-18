import Link from 'next/link';
import { Card } from '@sovereignfs/ui';
import type { MonthlyOverview as MonthlyOverviewData } from '../_lib/overviewActions';
import { shiftPeriod } from '../_lib/overviewActions';
import styles from './MonthlyOverview.module.css';

function formatPeriodLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  return new Date(year as number, (month as number) - 1, 1).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });
}

export function MonthlyOverview({ overview }: { overview: MonthlyOverviewData }) {
  const { currency } = overview;

  return (
    <section className={styles.section} aria-label="Monthly overview">
      <div className={styles.periodNav}>
        <Link href={`/ledger?period=${shiftPeriod(overview.period, -1)}`} className={styles.periodLink}>
          ← Previous
        </Link>
        <h2 className={styles.periodLabel}>{formatPeriodLabel(overview.period)}</h2>
        <Link href={`/ledger?period=${shiftPeriod(overview.period, 1)}`} className={styles.periodLink}>
          Next →
        </Link>
      </div>

      <div className={styles.statGrid}>
        <Card className={styles.statCard}>
          <p className={styles.statLabel}>Income</p>
          <p className={styles.statValue}>
            {currency} {overview.totalIncome}
          </p>
        </Card>
        <Card className={styles.statCard}>
          <p className={styles.statLabel}>Expenses</p>
          <p className={styles.statValue}>
            {currency} {overview.totalExpenses}
          </p>
        </Card>
        <Card className={styles.statCard}>
          <p className={styles.statLabel}>Savings</p>
          <p className={Number(overview.savings) < 0 ? styles.statValueNegative : styles.statValue}>
            {currency} {overview.savings}
          </p>
        </Card>
        <Card className={styles.statCard}>
          <p className={styles.statLabel}>Budget balance</p>
          <p className={Number(overview.balance) < 0 ? styles.statValueNegative : styles.statValue}>
            {currency} {overview.balance}
          </p>
        </Card>
      </div>

      <Card className={styles.groupCard}>
        <h3 className={styles.groupTitle}>Expenses by group</h3>
        <dl className={styles.groupList}>
          <div className={styles.groupRow}>
            <dt>Everyday spending</dt>
            <dd>
              {currency} {overview.expensesByGroup.dynamic}
            </dd>
          </div>
          <div className={styles.groupRow}>
            <dt>Fixed monthly costs</dt>
            <dd>
              {currency} {overview.expensesByGroup.fixedMonthly}
            </dd>
          </div>
          <div className={styles.groupRow}>
            <dt>Fixed yearly costs</dt>
            <dd>
              {currency} {overview.expensesByGroup.fixedYearly}
            </dd>
          </div>
        </dl>
      </Card>

      {overview.categoryVariance.length > 0 && (
        <Card className={styles.varianceCard}>
          <h3 className={styles.groupTitle}>Budget vs. actual</h3>
          <ul className={styles.varianceList}>
            {overview.categoryVariance.map((row) => (
              <li key={row.categoryId} className={styles.varianceRow}>
                <span className={styles.varianceLabel}>{row.label}</span>
                <span className={styles.varianceActual}>
                  {currency} {row.actual}
                  {row.budgeted !== null && <> / {row.budgeted}</>}
                </span>
                {row.variance !== null && (
                  <span
                    className={
                      Number(row.variance) < 0 ? styles.varianceNegative : styles.variancePositive
                    }
                  >
                    {Number(row.variance) < 0 ? 'Over by' : 'Under by'} {currency}{' '}
                    {Math.abs(Number(row.variance)).toFixed(2)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
