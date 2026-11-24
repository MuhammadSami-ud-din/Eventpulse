import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.schemas.js';
import { listUsersQuerySchema } from '../schemas/admin.schemas.js';
import { rejectEventSchema } from '../schemas/event.schemas.js';

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole('admin'));

adminRouter.post('/events/:id/approve', validate({ params: idParamSchema }), adminController.approveEvent);
adminRouter.post(
  '/events/:id/reject',
  validate({ params: idParamSchema, body: rejectEventSchema }),
  adminController.rejectEvent,
);
adminRouter.get('/users', validate({ query: listUsersQuerySchema }), adminController.listUsers);
