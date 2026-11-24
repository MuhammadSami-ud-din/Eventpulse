import { z } from 'zod';
import { parseTicketInput } from '../utils/ticketCode.js';

export const ticketCodeParamSchema = z.object({
  code: z
    .string()
    .max(100)
    .transform(parseTicketInput)
    .refine((code) => code !== null, 'This is not a valid ticket code'),
});
