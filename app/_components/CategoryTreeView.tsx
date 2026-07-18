import { Badge, Card } from '@sovereignfs/ui';
import type { CategoryNode } from '../_lib/categoryActions';
import { categoryGroupLabel } from '../_lib/categoryGroups';
import { AddSubcategoryDialog } from './AddSubcategoryDialog';
import styles from './CategoryTreeView.module.css';
import { RenameCategoryDialog } from './RenameCategoryDialog';
import { ToggleCategoryArchivedButton } from './ToggleCategoryArchivedButton';

export function CategoryTreeView({ categories }: { categories: CategoryNode[] }) {
  return (
    <div className={styles.list}>
      {categories.map((category) => (
        <Card key={category.id} className={styles.categoryCard}>
          <div className={styles.categoryHeader}>
            <div className={styles.categoryTitleRow}>
              <h2 className={category.archived ? styles.categoryNameArchived : styles.categoryName}>
                {category.name}
              </h2>
              <Badge variant="role">{categoryGroupLabel(category.group)}</Badge>
              {category.archived && <Badge variant="status" status="deactivated">Archived</Badge>}
            </div>
            <div className={styles.categoryActions}>
              <RenameCategoryDialog id={category.id} name={category.name} />
              <ToggleCategoryArchivedButton id={category.id} archived={category.archived} />
              <AddSubcategoryDialog parentId={category.id} parentName={category.name} />
            </div>
          </div>

          {category.subcategories.length > 0 && (
            <ul className={styles.subcategoryList}>
              {category.subcategories.map((sub) => (
                <li key={sub.id} className={styles.subcategoryRow}>
                  <span className={sub.archived ? styles.categoryNameArchived : undefined}>
                    {sub.name}
                  </span>
                  {sub.archived && (
                    <Badge variant="status" status="deactivated">
                      Archived
                    </Badge>
                  )}
                  <div className={styles.subcategoryActions}>
                    <RenameCategoryDialog id={sub.id} name={sub.name} />
                    <ToggleCategoryArchivedButton id={sub.id} archived={sub.archived} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}
