import { Router } from 'express';
import * as eventController from '../controllers/event.controller.js';
import * as registrationController from '../controllers/registration.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { publicRevalidate } from '../middleware/cacheControl.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.schemas.js';
import { listEventsQuerySchema } from '../schemas/event.schemas.js';

export const eventRouter = Router();

eventRouter.get('/', publicRevalidate, validate({ query: listEventsQuerySchema }), eventController.listEvents);
eventRouter.get('/:id', publicRevalidate, validate({ params: idParamSchema }), eventController.getEvent);
eventRouter.post(
  '/:id/registrations',
  authenticate,
  requireRole('student'),
  validate({ params: idParamSchema }),
  registrationController.register,
);
