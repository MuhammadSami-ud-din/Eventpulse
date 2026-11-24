import { z } from 'zod';
import { paginationFields } from './common.schemas.js';

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['student', 'organizer', 'admin']).optional(),
  ...paginationFields,
  pageSize: paginationFields.pageSize.default(25),
});
