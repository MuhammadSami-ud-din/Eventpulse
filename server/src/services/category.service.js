import { pool } from '../db/pool.js';
import { cacheKeys, remember } from './cache.js';

export function toCategory(row) {
  return { id: row.id, name: row.name, slug: row.slug, description: row.description };
}

export function listCategories() {
  return remember(cacheKeys.categories, async () => {
    const [rows] = await pool.query('SELECT id, name, slug, description FROM event_categories ORDER BY name');
    return rows.map(toCategory);
  });
}
