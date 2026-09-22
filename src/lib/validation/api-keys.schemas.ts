/**
 * API-key Zod schemas — shared by `/api/api-keys` and Server Functions.
 */

import { z } from "zod";
import { uuidSchema } from "./common.schemas";

export const apiKeyIdSchema = z.object({
  id: uuidSchema,
});

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional(),
  keyType: z.enum(["read", "write", "admin"]).default("read"),
  environment: z.enum(["production", "staging", "development"]).default("production"),
  permissionLevel: z.enum(["read", "write", "admin", "read_only"]).default("read_only"),
  securityLevel: z.enum(["low", "medium", "high", "standard"]).default("standard"),
  scopes: z.array(z.string().trim().min(1)).max(50).default([]),
  expiresInDays: z.number().int().positive().max(3650).optional(),
  rotationStrategy: z.enum(["manual", "automatic", "periodic", "none"]).default("none"),
});

export const listApiKeysQuerySchema = z.object({
  status: z.enum(["active", "inactive", "revoked"]).default("active"),
});

export function expiresAtFromDays(days: number | undefined): Date | null {
  if (!days) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
