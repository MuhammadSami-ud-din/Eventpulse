import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  categorySchema,
  changeRoleSchema,
  changeStatusSchema,
  createAccountSchema,
  listUsersQuerySchema,
} from '../schemas/admin.schemas.js';
import { idParamSchema, utcOffsetQuerySchema } from '../schemas/common.schemas.js';
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
adminRouter.post('/users', validate({ body: createAccountSchema }), adminController.createAccount);
adminRouter.put(
  '/users/:id/role',
  validate({ params: idParamSchema, body: changeRoleSchema }),
  adminController.changeRole,
);
adminRouter.put(
  '/users/:id/status',
  validate({ params: idParamSchema, body: changeStatusSchema }),
  adminController.changeStatus,
);

adminRouter.get('/categories', adminController.listCategories);
adminRouter.post('/categories', validate({ body: categorySchema }), adminController.createCategory);
adminRouter.put(
  '/categories/:id',
  validate({ params: idParamSchema, body: categorySchema }),
  adminController.updateCategory,
);
adminRouter.delete('/categories/:id', validate({ params: idParamSchema }), adminController.deleteCategory);

adminRouter.get('/analytics', validate({ query: utcOffsetQuerySchema }), adminController.getAnalytics);
