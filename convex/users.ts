import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Query to get the current user's information
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    return {
      id: identity.subject,
      name: identity.name,
      email: identity.email,
      pictureUrl: identity.pictureUrl,
    };
  },
});

// Example mutation that requires authentication
export const updateUserProfile = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Unauthenticated");
    }

    // Here you could update the user profile in your database
    // For now, we'll just return a success message
    return {
      success: true,
      message: `Profile updated for ${identity.name}`,
    };
  },
});
