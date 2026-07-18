'use server';

import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { ledgerCategories } from '../_db/schema';
import { CATEGORY_GROUP_VALUES } from './categoryGroups';
import { type ActionResult, getContext } from './db';
import { formString, now } from './formUtils';

export interface CategoryNode {
  id: string;
  name: string;
  group: string;
  archived: boolean;
  subcategories: CategoryNode[];
}

/** Top-level categories with their subcategories nested (LDG-03's "category tree"). */
export async function listCategories(): Promise<CategoryNode[]> {
  const { db, userId, tenantId } = await getContext();
  const rows = await db
    .select()
    .from(ledgerCategories)
    .where(and(eq(ledgerCategories.tenantId, tenantId), eq(ledgerCategories.userId, userId)))
    .orderBy(asc(ledgerCategories.sortOrder));

  const nodes = new Map<string, CategoryNode>(
    rows.map((row) => [
      row.id,
      { id: row.id, name: row.name, group: row.group, archived: row.archived, subcategories: [] },
    ]),
  );

  const topLevel: CategoryNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) continue;
    if (row.parentId) {
      const parent = nodes.get(row.parentId);
      // Parent may be absent if it belongs to another tenant/user — can't
      // happen given the shared WHERE clause above, but a subcategory whose
      // parent row is missing for any other reason is dropped rather than
      // surfaced as a confusing orphaned top-level entry.
      if (parent) parent.subcategories.push(node);
    } else {
      topLevel.push(node);
    }
  }

  return topLevel;
}

export async function createCategory(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { db, userId, tenantId } = await getContext();

  const name = formString(formData, 'name');
  if (!name) return { ok: false, error: 'Enter a category name.' };

  const group = formString(formData, 'group');
  if (!CATEGORY_GROUP_VALUES.has(group)) return { ok: false, error: 'Choose a group.' };

  const ts = now();
  try {
    await db.insert(ledgerCategories).values({
      id: randomUUID(),
      tenantId,
      userId,
      parentId: null,
      name,
      group,
      sortOrder: 0,
      archived: false,
      createdAt: ts,
      updatedAt: ts,
    });
  } catch {
    return { ok: false, error: 'Could not create this category. Please try again.' };
  }

  revalidatePath('/ledger/categories');
  return { ok: true, message: 'Category added.' };
}

export async function createSubcategory(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { db, userId, tenantId } = await getContext();

  const parentId = formString(formData, 'parentId');
  if (!parentId) return { ok: false, error: 'Missing parent category.' };

  const name = formString(formData, 'name');
  if (!name) return { ok: false, error: 'Enter a subcategory name.' };

  const [parent] = await db
    .select({ group: ledgerCategories.group })
    .from(ledgerCategories)
    .where(
      and(
        eq(ledgerCategories.id, parentId),
        eq(ledgerCategories.tenantId, tenantId),
        eq(ledgerCategories.userId, userId),
      ),
    );
  if (!parent) return { ok: false, error: 'Parent category not found.' };

  const ts = now();
  try {
    await db.insert(ledgerCategories).values({
      id: randomUUID(),
      tenantId,
      userId,
      parentId,
      name,
      // A subcategory always shares its parent's group — it's how the same
      // top-level budgeting bucket (dynamic/fixed monthly/fixed yearly)
      // stays consistent across a category and its children, and lets
      // rollup queries read `group` straight off the subcategory a
      // transaction actually points at without a join back to the parent.
      group: parent.group,
      sortOrder: 0,
      archived: false,
      createdAt: ts,
      updatedAt: ts,
    });
  } catch {
    return { ok: false, error: 'Could not create this subcategory. Please try again.' };
  }

  revalidatePath('/ledger/categories');
  return { ok: true, message: 'Subcategory added.' };
}

export async function renameCategory(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { db, userId, tenantId } = await getContext();

  const id = formString(formData, 'id');
  const name = formString(formData, 'name');
  if (!id || !name) return { ok: false, error: 'Enter a name.' };

  try {
    await db
      .update(ledgerCategories)
      .set({ name, updatedAt: now() })
      .where(
        and(
          eq(ledgerCategories.id, id),
          eq(ledgerCategories.tenantId, tenantId),
          eq(ledgerCategories.userId, userId),
        ),
      );
  } catch {
    return { ok: false, error: 'Could not rename this category. Please try again.' };
  }

  revalidatePath('/ledger/categories');
  return { ok: true, message: 'Category renamed.' };
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<void> {
  const { db, userId, tenantId } = await getContext();
  await db
    .update(ledgerCategories)
    .set({ archived, updatedAt: now() })
    .where(
      and(
        eq(ledgerCategories.id, id),
        eq(ledgerCategories.tenantId, tenantId),
        eq(ledgerCategories.userId, userId),
      ),
    );
  revalidatePath('/ledger/categories');
}
