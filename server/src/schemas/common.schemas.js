import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const paginationFields = {
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
};

// Requires an explicit offset (e.g. "2026-12-01T09:00:00Z" or "+05:00") so the
// server never has to guess which time zone a bare date-time was meant in.
// `abort` stops parsing on failure, so object-level refinements that compare
// dates never receive the raw, unparsed string.
export const isoDateTime = z.iso
  .datetime({
    offset: true,
    abort: true,
    error: 'Use an ISO date-time with a time zone, e.g. 2026-12-01T09:00:00Z',
  })
  .transform((value) => new Date(value));
