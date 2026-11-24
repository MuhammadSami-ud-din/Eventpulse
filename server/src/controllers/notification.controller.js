import * as notificationService from '../services/notification.service.js';

export async function list(req, res) {
  res.json(await notificationService.listNotifications(req.user.id, req.validated.query));
}

export async function unreadCount(req, res) {
  res.json({ unreadCount: await notificationService.countUnread(req.user.id) });
}

export async function markRead(req, res) {
  res.json(await notificationService.markRead(req.user.id, req.validated.params.id));
}

export async function markAllRead(req, res) {
  res.json(await notificationService.markAllRead(req.user.id));
}
