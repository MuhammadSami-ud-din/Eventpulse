import { listCategories } from '../services/category.service.js';

export async function getCategories(req, res) {
  res.json({ data: await listCategories() });
}
