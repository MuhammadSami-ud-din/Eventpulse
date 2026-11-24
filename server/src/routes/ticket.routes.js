import { Router } from 'express';
import { getTicket } from '../controllers/ticket.controller.js';
import { ticketLookupLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.js';
import { ticketCodeParamSchema } from '../schemas/ticket.schemas.js';

export const ticketRouter = Router();

ticketRouter.get('/:code', ticketLookupLimiter, validate({ params: ticketCodeParamSchema }), getTicket);
