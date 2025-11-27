import { Auth } from "convex/server";

/**
 * Gets the authenticated user's ID
 * @throws Error if not authenticated
 */
export async function getUserId(ctx: { auth: Auth }): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity.subject;
}

/**
 * Requires authentication and returns the user identity
 * @throws Error if not authenticated
 */
export async function requireAuth(ctx: { auth: Auth }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}

/**
 * Gets the authenticated user's ID or returns null
 * Use this for queries that should return empty results for unauthenticated users
 */
export async function getUserIdOrNull(ctx: { auth: Auth }): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  return identity.subject;
}

