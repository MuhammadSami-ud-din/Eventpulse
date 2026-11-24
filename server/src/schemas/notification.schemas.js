import { z } from 'zod';
import { paginationFields } from './common.schemas.js';

export const listNotificationsQuerySchema = z.object({
  ...paginationFields,
  pageSize: paginationFields.pageSize.default(20),
});
