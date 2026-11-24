import { pool } from '../db/pool.js';
import { HttpError } from '../utils/HttpError.js';
import { slugify } from '../utils/slug.js';
import { cacheKeys, invalidateAllEvents, invalidateCategories, remember } from './cache.js';

const categoryNotFound = () => new HttpError(404, 'CATEGORY_NOT_FOUND', 'Category not found');

function categoryExists() {
  const message = 'A category with this name (or a very similar one) already exists';
  return new HttpError(409, 'CATEGORY_EXISTS', message, [{ field: 'name', message }]);
}

export function toCategory(row) {
  return { id: row.id, name: row.name, slug: row.slug, description: row.description };
}

export function listCategories() {
  return remember(cacheKeys.categories, async () => {
    const [rows] = await pool.query('SELECT id, name, slug, description FROM event_categories ORDER BY name');
    return rows.map(toCategory);
  });
}

// For the admin screen: every category with the number of events using it,
// since only unused categories can be deleted.
export async function listCategoriesWithUsage() {
  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.slug, c.description, COUNT(e.id) AS event_count
     FROM event_categories c
     LEFT JOIN events e ON e.category_id = c.id
     GROUP BY c.id
     ORDER BY c.name`,
  );
  return rows.map((row) => ({ ...toCategory(row), eventCount: Number(row.event_count) }));
}

async function findCategory(categoryId) {
  const [rows] = await pool.query('SELECT id, name, slug, description FROM event_categories WHERE id = ?', [
    categoryId,
  ]);
  if (!rows[0]) throw categoryNotFound();
  return toCategory(rows[0]);
}

// The slug is set once, here. The event list filters by slug (/?category=sports),
// so renaming a category later must not break links people have shared.
export async function createCategory({ name, description }) {
  try {
    const [result] = await pool.query(
      'INSERT INTO event_categories (name, slug, description) VALUES (?, ?, ?)',
      [name, slugify(name), description ?? null],
    );
    invalidateCategories();
    return findCategory(result.insertId);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw categoryExists();
    throw err;
  }
}

export async function updateCategory(categoryId, { name, description }) {
  try {
    await pool.query('UPDATE event_categories SET name = ?, description = ? WHERE id = ?', [
      name,
      description ?? null,
      categoryId,
    ]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw categoryExists();
    throw err;
  }
  invalidateCategories();
  invalidateAllEvents();
  return findCategory(categoryId);
}

// The foreign key from events is the real guard: checking a count first could
// race with an organizer creating an event in this category.
export async function deleteCategory(categoryId) {
  let result;
  try {
    [result] = await pool.query('DELETE FROM event_categories WHERE id = ?', [categoryId]);
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw new HttpError(409, 'CATEGORY_IN_USE', 'Events use this category, so it cannot be deleted');
    }
    throw err;
  }
  if (result.affectedRows === 0) throw categoryNotFound();
  invalidateCategories();
}
