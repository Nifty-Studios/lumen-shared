// Accounts and sharing: the wire format between the apps and lumen-server.
//   POST /auth/signup  SignUpRequest -> AuthResponse      POST /auth/login  LogInRequest -> AuthResponse
//   POST /auth/logout                                     GET  /me -> Me
//   POST /auth/claim-legacy (x-legacy-token header): ownerless workspaces from before accounts -> this user
//   GET/POST/DELETE /spaces/:id/members                   GET/POST/DELETE /pages/:id/shares
//   GET  /sync/live?token=… (WebSocket): LiveMessage
//   Notifications, friends and the personal dictionary are described further down.
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

export const inviteRequestSchema = z.object({
  email,
  role: z.enum(SPACE_ROLES),
  /** The page or workspace name, for the notification the other person gets. */
  title: z.string().trim().max(200).optional(),
});
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

// --- notifications ---
//   GET  /notifications -> NotificationList        POST /notifications/read {ids?} (none = all)

export const NOTIFICATION_KINDS = ["page_shared", "space_shared", "friend_request", "friend_accepted"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const notificationSchema = z.object({
  id: z.string(),
  kind: z.enum(NOTIFICATION_KINDS),
  title: z.string(),
  body: z.string(),
  /** Who caused it. */
  actor: z.object({ id: z.string(), name: z.string(), email: z.string() }).optional(),
  /** The page to open (a shared page, or a shared workspace's first page). */
  page_id: z.string().optional(),
  space_id: z.string().optional(),
  /** The friend request it's about. */
  friendship_id: z.string().optional(),
  created_at: z.number(),
  read_at: z.number().optional(),
});
export type LumenNotification = z.infer<typeof notificationSchema>;
export const notificationListSchema = z.object({ notifications: z.array(notificationSchema) });
export const markReadSchema = z.object({ ids: z.array(z.string()).max(500).optional() });

// --- friends ---
//   GET /friends -> FriendList    POST /friends {email}    POST /friends/:id/accept    DELETE /friends/:id

export const friendSchema = z.object({
  /** The friendship (or request) id. */
  id: z.string(),
  user: userSchema,
  /** accepted; incoming = they asked you; outgoing = you asked them. */
  status: z.enum(["accepted", "incoming", "outgoing"]),
  since: z.number(),
});
export type Friend = z.infer<typeof friendSchema>;
export const friendListSchema = z.object({ friends: z.array(friendSchema) });
export const friendRequestSchema = z.object({ email });

// --- personal dictionary (words the spellchecker accepts, each with an optional meaning) ---
//   GET /dictionary -> Dictionary    POST /dictionary {add?, remove?, define?} -> Dictionary

const word = z.string().trim().min(1).max(64);
const meaning = z.string().trim().max(2000);
export const dictionaryEntrySchema = z.object({ word: z.string(), meaning: z.string().optional() });
export type DictionaryEntry = z.infer<typeof dictionaryEntrySchema>;
export const dictionarySchema = z.object({
  words: z.array(z.string()),
  /** The same words with their meanings (missing from servers before meanings existed). */
  entries: z.array(dictionaryEntrySchema).optional(),
});
export const dictionaryChangeSchema = z.object({
  add: z.array(word).max(1000).optional(),
  remove: z.array(word).max(1000).optional(),
  /** Sets meanings (adding the word if needed); an empty meaning clears it. */
  define: z.array(z.object({ word, meaning })).max(1000).optional(),
});

/** Server -> client over the live socket. */
export type LiveMessage = { type: "ops" } | { type: "access" } | { type: "inbox" } | { type: "friends" } | { type: "dictionary" } | { type: "ping" };
