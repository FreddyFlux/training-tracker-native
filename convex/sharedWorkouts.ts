import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getUserId, getUserIdOrNull, requireAuth } from "./auth";
import type { Id } from "./_generated/dataModel";

/**
 * List all shared workouts (public, no auth required)
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdOrNull(ctx);
    const sharedWorkouts = await ctx.db
      .query("sharedWorkouts")
      .order("desc")
      .collect();

    // Get exercises for each shared workout and check if user has liked it
    const workoutsWithExercises = await Promise.all(
      sharedWorkouts.map(async (workout) => {
        const exercises = await ctx.db
          .query("sharedWorkoutExercises")
          .withIndex("by_shared_workout", (q) =>
            q.eq("sharedWorkoutId", workout._id)
          )
          .collect();

        const sortedExercises = exercises.sort((a, b) => a.order - b.order);

        const exercisesWithDetails = await Promise.all(
          sortedExercises.map(async (we) => {
            const exercise = await ctx.db.get(we.exerciseId);
            return { ...we, exercise };
          })
        );

        // Check if current user has liked this workout
        let hasLiked = false;
        if (userId) {
          const like = await ctx.db
            .query("sharedWorkoutLikes")
            .withIndex("by_shared_workout_and_user", (q) =>
              q.eq("sharedWorkoutId", workout._id).eq("userId", userId)
            )
            .first();
          hasLiked = !!like;
        }

        return {
          ...workout,
          exercises: exercisesWithDetails,
          hasLiked,
        };
      })
    );

    return workoutsWithExercises;
  },
});

/**
 * Search shared workouts by name (public, no auth required)
 */
export const search = query({
  args: { searchQuery: v.string() },
  handler: async (ctx, args) => {
    if (!args.searchQuery || args.searchQuery.trim().length === 0) {
      return [];
    }

    const userId = await getUserIdOrNull(ctx);
    const results = await ctx.db
      .query("sharedWorkouts")
      .withSearchIndex("search_name", (q) => q.search("name", args.searchQuery))
      .collect();

    // Get exercises for each shared workout and check if user has liked it
    const workoutsWithExercises = await Promise.all(
      results.map(async (workout) => {
        const exercises = await ctx.db
          .query("sharedWorkoutExercises")
          .withIndex("by_shared_workout", (q) =>
            q.eq("sharedWorkoutId", workout._id)
          )
          .collect();

        const sortedExercises = exercises.sort((a, b) => a.order - b.order);

        const exercisesWithDetails = await Promise.all(
          sortedExercises.map(async (we) => {
            const exercise = await ctx.db.get(we.exerciseId);
            return { ...we, exercise };
          })
        );

        // Check if current user has liked this workout
        let hasLiked = false;
        if (userId) {
          const like = await ctx.db
            .query("sharedWorkoutLikes")
            .withIndex("by_shared_workout_and_user", (q) =>
              q.eq("sharedWorkoutId", workout._id).eq("userId", userId)
            )
            .first();
          hasLiked = !!like;
        }

        return {
          ...workout,
          exercises: exercisesWithDetails,
          hasLiked,
        };
      })
    );

    return workoutsWithExercises;
  },
});

/**
 * Get a specific shared workout by ID (public, no auth required)
 */
export const getById = query({
  args: { id: v.id("sharedWorkouts") },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    const workout = await ctx.db.get(args.id);
    if (!workout) return null;

    // Get exercises
    const exercises = await ctx.db
      .query("sharedWorkoutExercises")
      .withIndex("by_shared_workout", (q) =>
        q.eq("sharedWorkoutId", args.id)
      )
      .collect();

    const sortedExercises = exercises.sort((a, b) => a.order - b.order);

    const exercisesWithDetails = await Promise.all(
      sortedExercises.map(async (we) => {
        const exercise = await ctx.db.get(we.exerciseId);
        return { ...we, exercise };
      })
    );

    // Check if current user has liked this workout
    let hasLiked = false;
    if (userId) {
      const like = await ctx.db
        .query("sharedWorkoutLikes")
        .withIndex("by_shared_workout_and_user", (q) =>
          q.eq("sharedWorkoutId", args.id).eq("userId", userId)
        )
        .first();
      hasLiked = !!like;
    }

    return {
      ...workout,
      exercises: exercisesWithDetails,
      hasLiked,
    };
  },
});

/**
 * Share a workout (create a copy in sharedWorkouts table)
 */
export const share = mutation({
  args: { workoutId: v.id("workouts") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const identity = await requireAuth(ctx);

    // Get existing workout
    const workout = await ctx.db.get(args.workoutId);
    if (!workout || workout.userId !== userId) {
      throw new Error("Workout not found");
    }

    // Get exercises for this workout
    const exercises = await ctx.db
      .query("workoutExercises")
      .withIndex("by_workout", (q) => q.eq("workoutId", args.workoutId))
      .collect();

    if (exercises.length === 0) {
      throw new Error("Cannot share a workout without exercises");
    }

    // Sort exercises by order
    const sortedExercises = exercises.sort((a, b) => a.order - b.order);

    // Create shared workout
    const sharedWorkoutId = await ctx.db.insert("sharedWorkouts", {
      userId,
      sharedByName: identity.name || "User",
      name: workout.name,
      likeCount: 0,
      usageCounter: 0,
      createdAt: Date.now(),
    });

    // Copy exercises to shared workout exercises
    const exerciseIdMap = new Map<Id<"workoutExercises">, Id<"sharedWorkoutExercises">>();
    
    // First pass: create all exercises without superset relationships
    for (const exercise of sortedExercises) {
      const exerciseExists = await ctx.db.get(exercise.exerciseId);
      if (!exerciseExists) {
        throw new Error(`Exercise ${exercise.exerciseId} not found`);
      }

      const sharedExerciseId = await ctx.db.insert("sharedWorkoutExercises", {
        sharedWorkoutId,
        exerciseId: exercise.exerciseId,
        order: exercise.order,
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        restTime: exercise.restTime,
        supersetWith: undefined, // Will be set in second pass
      });
      exerciseIdMap.set(exercise._id, sharedExerciseId);
    }

    // Second pass: update superset relationships
    for (const exercise of sortedExercises) {
      if (exercise.supersetWith) {
        // Find the corresponding shared workout exercise
        const sharedExerciseId = exerciseIdMap.get(exercise._id);
        const sharedSupersetWithId = exerciseIdMap.get(exercise.supersetWith);
        if (sharedExerciseId && sharedSupersetWithId) {
          await ctx.db.patch(sharedExerciseId, {
            supersetWith: sharedSupersetWithId,
          });
        }
      }
    }

    return sharedWorkoutId;
  },
});

/**
 * Check if the current user has liked a shared workout
 */
export const hasLiked = query({
  args: { sharedWorkoutId: v.id("sharedWorkouts") },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return false;

    const like = await ctx.db
      .query("sharedWorkoutLikes")
      .withIndex("by_shared_workout_and_user", (q) =>
        q.eq("sharedWorkoutId", args.sharedWorkoutId).eq("userId", userId)
      )
      .first();

    return !!like;
  },
});

/**
 * Like or unlike a shared workout
 */
export const like = mutation({
  args: { sharedWorkoutId: v.id("sharedWorkouts") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get shared workout
    const workout = await ctx.db.get(args.sharedWorkoutId);
    if (!workout) {
      throw new Error("Shared workout not found");
    }

    // Check if user already liked this workout
    const existingLike = await ctx.db
      .query("sharedWorkoutLikes")
      .withIndex("by_shared_workout_and_user", (q) =>
        q.eq("sharedWorkoutId", args.sharedWorkoutId).eq("userId", userId)
      )
      .first();

    const currentLikeCount = workout.likeCount || 0;

    if (existingLike) {
      // Unlike: remove the like and decrement count
      await ctx.db.delete(existingLike._id);
      await ctx.db.patch(args.sharedWorkoutId, {
        likeCount: Math.max(0, currentLikeCount - 1),
      });
      return { liked: false, likeCount: Math.max(0, currentLikeCount - 1) };
    } else {
      // Like: add the like and increment count
      await ctx.db.insert("sharedWorkoutLikes", {
        sharedWorkoutId: args.sharedWorkoutId,
        userId,
        createdAt: Date.now(),
      });
      await ctx.db.patch(args.sharedWorkoutId, {
        likeCount: currentLikeCount + 1,
      });
      return { liked: true, likeCount: currentLikeCount + 1 };
    }
  },
});

/**
 * Increment usage counter for a shared workout
 * Called when a workout based on a shared workout is completed or edited
 */
export const incrementUsage = mutation({
  args: { sharedWorkoutId: v.id("sharedWorkouts") },
  handler: async (ctx, args) => {
    const workout = await ctx.db.get(args.sharedWorkoutId);
    if (!workout) {
      throw new Error("Shared workout not found");
    }

    const currentUsageCounter = workout.usageCounter || 0;
    await ctx.db.patch(args.sharedWorkoutId, {
      usageCounter: currentUsageCounter + 1,
    });

    return currentUsageCounter + 1;
  },
});

