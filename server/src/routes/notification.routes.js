import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.schemas.js';
import { listNotificationsQuerySchema } from '../schemas/notification.schemas.js';

// Every role gets notifications (organizers hear about approvals), so this is
// not under /api/me, which is students only.
export const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get('/', validate({ query: listNotificationsQuerySchema }), notificationController.list);
notificationRouter.get('/unread-count', notificationController.unreadCount);
notificationRouter.post('/read-all', notificationController.markAllRead);
notificationRouter.post('/:id/read', validate({ params: idParamSchema }), notificationController.markRead);
