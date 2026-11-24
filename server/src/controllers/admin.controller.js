import { getPlatformAnalytics } from '../services/adminAnalytics.service.js';
import * as adminUsers from '../services/adminUser.service.js';
import * as categories from '../services/category.service.js';
import * as eventManagement from '../services/eventManagement.service.js';
import { withTimeFlags } from '../utils/eventTiming.js';

export async function approveEvent(req, res) {
  const event = await eventManagement.approveEvent(req.user, req.validated.params.id);
  res.json({ event: withTimeFlags(event) });
}

export async function rejectEvent(req, res) {
  const event = await eventManagement.rejectEvent(req.user, req.validated.params.id, req.validated.body.reason);
  res.json({ event: withTimeFlags(event) });
}

export async function listUsers(req, res) {
  res.json(await adminUsers.listUsers(req.validated.query));
}

export async function createAccount(req, res) {
  res.status(201).json({ user: await adminUsers.createAccount(req.validated.body) });
}

export async function changeRole(req, res) {
  res.json({ user: await adminUsers.changeRole(req.user, req.validated.params.id, req.validated.body.role) });
}

export async function changeStatus(req, res) {
  res.json(await adminUsers.setActive(req.user, req.validated.params.id, req.validated.body.isActive));
}

export async function listCategories(req, res) {
  res.json({ data: await categories.listCategoriesWithUsage() });
}

export async function createCategory(req, res) {
  res.status(201).json({ category: await categories.createCategory(req.validated.body) });
}

export async function updateCategory(req, res) {
  res.json({ category: await categories.updateCategory(req.validated.params.id, req.validated.body) });
}

export async function deleteCategory(req, res) {
  await categories.deleteCategory(req.validated.params.id);
  res.status(204).end();
}

export async function getAnalytics(req, res) {
  res.json(await getPlatformAnalytics(req.validated.query));
}
