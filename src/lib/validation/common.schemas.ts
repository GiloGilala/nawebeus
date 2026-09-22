/**
 * Cross-cutting Zod schemas (tanstack-start.md Appendix A).
 *
 * Shared between TanStack Form, Server Functions, and Hono routes — never
 * duplicated at a boundary.
 */

import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const emailSchema = z.string().email("Invalid email address");

/** Nigerian mobile: 11 digits starting 070/080/081/090/091. */
export const phoneSchema = z.string().regex(/^0[789][01]\d{8}$/, "Invalid Nigerian phone number");

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
