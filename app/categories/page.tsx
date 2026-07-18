import { EmptyState, PageHeader } from '@sovereignfs/ui';
import { BackLink } from '../_components/BackLink';
import { CategoryTreeView } from '../_components/CategoryTreeView';
import { CreateCategoryDialog } from '../_components/CreateCategoryDialog';
import { listCategories } from '../_lib/categoryActions';
import styles from './page.module.css';

export default async function CategoriesPage() {
  const categories = await listCategories();

  return (
    <div className={styles.page}>
      <BackLink href="/ledger">Back</BackLink>

      <PageHeader
        title="Categories"
        description="Group your spending into categories and subcategories."
        action={<CreateCategoryDialog />}
      />

      {categories.length === 0 ? (
        <EmptyState
          heading="No categories yet"
          description="Add a category — Housing, Groceries, Subscriptions — to start organizing your budget."
        />
      ) : (
        <CategoryTreeView categories={categories} />
      )}
    </div>
  );
}
