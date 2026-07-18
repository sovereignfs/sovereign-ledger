import { Card } from '@sovereignfs/ui';
import type { SubcategoryOption, Transaction } from '../_lib/expenseActions';
import { DeleteTransactionButton } from './DeleteTransactionButton';
import { EditTransactionDialog } from './EditTransactionDialog';
import styles from './TransactionList.module.css';

export function TransactionList({
  transactions,
  subcategories,
}: {
  transactions: Transaction[];
  subcategories: SubcategoryOption[];
}) {
  return (
    <Card className={styles.card}>
      <ul className={styles.list}>
        {transactions.map((transaction) => (
          <li key={transaction.id} className={styles.row}>
            <span className={styles.date}>{transaction.date}</span>
            <div className={styles.details}>
              <span className={styles.category}>{transaction.categoryLabel}</span>
              {transaction.note && <span className={styles.note}>{transaction.note}</span>}
            </div>
            <span className={styles.amount}>
              {transaction.currency} {transaction.amount}
            </span>
            <div className={styles.actions}>
              <EditTransactionDialog transaction={transaction} subcategories={subcategories} />
              <DeleteTransactionButton id={transaction.id} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
