// Wire format between clients and the sync server.
//   POST /sync/push  PushRequest  -> PushResponse
//   GET  /sync/pull?since=<cursor>&limit=<n> -> PullResponse
// The cursor is the server's monotonically increasing op sequence number. Auth: see account.ts.

import { z } from "zod";
import { TABLES } from "./model";

export const MAX_PUSH_OPS = 5000;
export const DEFAULT_PULL_LIMIT = 1000;

export const opSchema = z.object({
  id: z.string().min(1),
  table: z.enum(TABLES),
  record_id: z.string().min(1),
  path: z.array(z.string()).min(1),
  value: z.json(),
  hlc: z.string().min(1),
  device_id: z.string().min(1),
});

export const pushRequestSchema = z.object({
  device_id: z.string().min(1),
  ops: z.array(opSchema).max(MAX_PUSH_OPS),
});
export type PushRequest = z.infer<typeof pushRequestSchema>;

export const pushResponseSchema = z.object({
  /** Ops newly stored (duplicates by id are ignored). */
  accepted: z.number().int().nonnegative(),
  /** Ops this account isn't allowed to make (e.g. a viewer's edits); never stored or relayed. */
  rejected: z.array(z.string()).default([]),
});
export type PushResponse = z.infer<typeof pushResponseSchema>;

export const pullQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(DEFAULT_PULL_LIMIT).default(DEFAULT_PULL_LIMIT),
  /** Skip ops this device pushed itself. */
  device_id: z.string().optional(),
});
export type PullQuery = z.infer<typeof pullQuerySchema>;

export const pullResponseSchema = z.object({
  ops: z.array(opSchema),
  cursor: z.number().int().nonnegative(),
  has_more: z.boolean(),
});
export type PullResponse = z.infer<typeof pullResponseSchema>;
