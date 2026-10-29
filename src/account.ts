// Accounts and sharing: the wire format between the apps and lumen-server.
//   POST /auth/signup  SignUpRequest -> AuthResponse      POST /auth/login  LogInRequest -> AuthResponse
//   POST /auth/logout                                     GET  /me -> Me
//   POST /auth/claim-legacy (x-legacy-token header): ownerless workspaces from before accounts -> this user
//   GET/POST/DELETE /spaces/:id/members                   GET/POST/DELETE /pages/:id/shares
//   GET  /sync/live?token=… (WebSocket): LiveMessage
// Every other request carries `authorization: Bearer <token>`.

import { z } from "zod";

export const SPACE_ROLES = ["owner", "editor", "viewer"] as const;
export type SpaceRole = (typeof SPACE_ROLES)[number];
export const PAGE_ROLES = ["editor", "viewer"] as const;
export type PageRole = (typeof PAGE_ROLES)[number];
export type Role = SpaceRole;

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };
/** The stronger of two roles (either may be missing). */
export const strongerRole = (a: Role | undefined, b: Role | undefined): Role | undefined =>
  !a ? b : !b ? a : RANK[a] >= RANK[b] ? a : b;
export const canEdit = (role: Role | undefined) => role === "owner" || role === "editor";

export const MIN_PASSWORD = 8;

const email = z.email().max(254).transform((e) => e.trim().toLowerCase());

export const signUpRequestSchema = z.object({
  email,
  password: z.string().min(MIN_PASSWORD).max(200),
  name: z.string().trim().min(1).max(80),
  device_name: z.string().trim().min(1).max(80),
});
export type SignUpRequest = z.input<typeof signUpRequestSchema>;

export const logInRequestSchema = z.object({
  email,
  password: z.string().min(1).max(200),
  device_name: z.string().trim().min(1).max(80),
});
export type LogInRequest = z.input<typeof logInRequestSchema>;

export const userSchema = z.object({ id: z.string(), email: z.string(), name: z.string() });
export type User = z.infer<typeof userSchema>;

export const authResponseSchema = z.object({ user: userSchema, token: z.string() });
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const meSchema = z.object({
  user: userSchema,
  /** Workspaces this user is a member of. */
  spaces: z.array(z.object({ id: z.string(), role: z.enum(SPACE_ROLES) })),
  /** Pages shared with this user directly (outside workspaces they belong to). */
  pages: z.array(z.object({ id: z.string(), space_id: z.string(), role: z.enum(PAGE_ROLES) })),
});
export type Me = z.infer<typeof meSchema>;

export const inviteRequestSchema = z.object({ email, role: z.enum(SPACE_ROLES) });
export type InviteRequest = z.input<typeof inviteRequestSchema>;

export const personSchema = z.object({
  /** Missing while the invite is pending (no account with that email yet). */
  user_id: z.string().optional(),
  email: z.string(),
  name: z.string().optional(),
  role: z.enum(SPACE_ROLES),
  pending: z.boolean(),
});
export type Person = z.infer<typeof personSchema>;
export const peopleSchema = z.object({ people: z.array(personSchema) });

export const removePersonSchema = z.object({ email });

/** Server -> client over the live socket. */
export type LiveMessage = { type: "ops" } | { type: "access" } | { type: "ping" };
