import { Router } from 'express';
import * as attendance from '../controllers/attendance.controller.js';
import * as organizerEvents from '../controllers/organizerEvent.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { checkInSchema, markAttendanceSchema, registrationParamsSchema } from '../schemas/attendance.schemas.js';
import { idParamSchema } from '../schemas/common.schemas.js';
import { createEventSchema, managedEventsQuerySchema, updateEventSchema } from '../schemas/event.schemas.js';
import { eventRegistrationsQuerySchema } from '../schemas/registration.schemas.js';

export const organizerRouter = Router();

// Admins can use every organizer endpoint; ownership is checked per event in the service.
organizerRouter.use(authenticate, requireRole('organizer', 'admin'));

const byId = validate({ params: idParamSchema });

organizerRouter.get('/events', validate({ query: managedEventsQuerySchema }), organizerEvents.listMyEvents);
organizerRouter.post('/events', validate({ body: createEventSchema }), organizerEvents.createEvent);
organizerRouter.get('/events/:id', byId, organizerEvents.getMyEvent);
organizerRouter.patch(
  '/events/:id',
  validate({ params: idParamSchema, body: updateEventSchema }),
  organizerEvents.updateEvent,
);
organizerRouter.delete('/events/:id', byId, organizerEvents.deleteEvent);
organizerRouter.post('/events/:id/publish', byId, organizerEvents.publishEvent);
organizerRouter.post('/events/:id/close', byId, organizerEvents.closeEvent);
organizerRouter.get(
  '/events/:id/registrations',
  validate({ params: idParamSchema, query: eventRegistrationsQuerySchema }),
  organizerEvents.listEventRegistrations,
);

organizerRouter.post(
  '/events/:id/check-in',
  validate({ params: idParamSchema, body: checkInSchema }),
  attendance.checkIn,
);
organizerRouter.put(
  '/events/:id/registrations/:registrationId/attendance',
  validate({ params: registrationParamsSchema, body: markAttendanceSchema }),
  attendance.markAttendance,
);
organizerRouter.post('/events/:id/attendance/no-shows', byId, attendance.markRemainingNoShows);
