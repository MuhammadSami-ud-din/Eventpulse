import { z } from 'zod';
import { parseTicketInput } from '../utils/ticketCode.js';

export const registrationParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  registrationId: z.coerce.number().int().positive(),
});

export const checkInSchema = z.object({
  code: z
    .string()
    .max(100)
    .transform(parseTicketInput)
    .refine((code) => code !== null, 'This is not an EventPulse ticket code'),
});

export const markAttendanceSchema = z.object({
  status: z.enum(['attended', 'no_show']),
});
