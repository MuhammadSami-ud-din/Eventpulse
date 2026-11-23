import { Router } from 'express';
import * as registrationController from '../controllers/registration.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.schemas.js';
import { myRegistrationsQuerySchema } from '../schemas/registration.schemas.js';

// Routes about the logged-in student's own data. There is no user id in any
// URL here: the owner is always req.user, so one student cannot ask for another's.
export const meRouter = Router();

meRouter.use(authenticate, requireRole('student'));

meRouter.get('/registrations', validate({ query: myRegistrationsQuerySchema }), registrationController.listMine);
meRouter.get('/registrations/:id', validate({ params: idParamSchema }), registrationController.getMine);
meRouter.post('/registrations/:id/cancel', validate({ params: idParamSchema }), registrationController.cancelMine);
