import { Router } from 'express';
import * as adminEvents from '../controllers/adminEvent.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.schemas.js';
import { rejectEventSchema } from '../schemas/event.schemas.js';

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole('admin'));

adminRouter.post('/events/:id/approve', validate({ params: idParamSchema }), adminEvents.approveEvent);
adminRouter.post(
  '/events/:id/reject',
  validate({ params: idParamSchema, body: rejectEventSchema }),
  adminEvents.rejectEvent,
);
