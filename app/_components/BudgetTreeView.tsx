import Link from 'next/link';
import { Badge, Card } from '@sovereignfs/ui';
import type { BudgetNode } from '../_lib/budgetActions';
import { categoryGroupLabel } from '../_lib/categoryGroups';
import styles from './BudgetTreeView.module.css';
import { DefaultBudgetForm } from './DefaultBudgetForm';

function Row({ node, indent }: { node: BudgetNode; indent: boolean }) {
  return (
    <div className={indent ? styles.subRow : styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.name}>{node.name}</span>
        <Badge variant="role">{categoryGroupLabel(node.group)}</Badge>
      </div>
      <div className={styles.rowActions}>
        <DefaultBudgetForm
          categoryId={node.id}
          amount={node.defaultAmount}
          currency={node.currency}
        />
        <Link href={`/ledger/budgets/${node.id}`} className={styles.overridesLink}>
          Month overrides
        </Link>
      </div>
    </div>
  );
}

export function BudgetTreeView({ categories }: { categories: BudgetNode[] }) {
  return (
    <div className={styles.list}>
      {categories.map((category) => (
        <Card key={category.id} className={styles.categoryCard}>
          <Row node={category} indent={false} />
          {category.subcategories.length > 0 && (
            <div className={styles.subList}>
              {category.subcategories.map((sub) => (
                <Row key={sub.id} node={sub} indent />
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
