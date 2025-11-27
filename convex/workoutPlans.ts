import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getUserId, getUserIdOrNull, requireAuth } from "./auth";
import slugify from "slugify";

/**
 * List all workout plans for the authenticated user
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return [];

    const plans = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return plans;
  },
});

/**
 * Get a specific workout plan by ID
 */
export const getById = query({
  args: { id: v.id("workoutPlans") },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return null;

    const plan = await ctx.db.get(args.id);

    // Verify ownership
    if (!plan || plan.userId !== userId) {
      return null;
    }

    return plan;
  },
});

/**
 * Get a specific workout plan by slug
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return null;

    const plan = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user_and_slug", (q) =>
        q.eq("userId", userId).eq("slug", args.slug)
      )
      .first();

    return plan;
  },
});

/**
 * Get the active workout plan with all workouts
 */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return null;

    // Find active plan
    const plan = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user_and_active", (q) =>
        q.eq("userId", userId).eq("isActive", true)
      )
      .first();

    if (!plan) return null;

    // Get workouts for this plan
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .collect();

    // Sort workouts by order
    const sortedWorkouts = workouts.sort((a, b) => a.order - b.order);

    return {
      ...plan,
      workouts: sortedWorkouts,
    };
  },
});

/**
 * Get a workout plan with all its workouts and exercises
 */
export const getWithWorkouts = query({
  args: { planId: v.id("workoutPlans") },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return null;

    // Get plan
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== userId) {
      return null;
    }

    // Get related workouts
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_plan", (q) => q.eq("planId", args.planId))
      .collect();

    // Get exercises for each workout
    const workoutsWithExercises = await Promise.all(
      workouts.map(async (workout) => {
        const workoutExercises = await ctx.db
          .query("workoutExercises")
          .withIndex("by_workout", (q) => q.eq("workoutId", workout._id))
          .collect();

        // Sort by order
        const sortedExercises = workoutExercises.sort(
          (a, b) => a.order - b.order
        );

        // Get exercise details
        const exercisesWithDetails = await Promise.all(
          sortedExercises.map(async (we) => {
            const exercise = await ctx.db.get(we.exerciseId);
            return { ...we, exercise };
          })
        );

        return { ...workout, exercises: exercisesWithDetails };
      })
    );

    // Sort workouts by order
    const sortedWorkouts = workoutsWithExercises.sort((a, b) => a.order - b.order);

    return {
      ...plan,
      workouts: sortedWorkouts,
    };
  },
});

/**
 * Get a workout plan with all its workouts and exercises by slug
 */
export const getWithWorkoutsBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return null;

    // Get plan by slug
    const plan = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user_and_slug", (q) =>
        q.eq("userId", userId).eq("slug", args.slug)
      )
      .first();

    if (!plan) return null;

    // Get related workouts
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .collect();

    // Get exercises for each workout
    const workoutsWithExercises = await Promise.all(
      workouts.map(async (workout) => {
        const workoutExercises = await ctx.db
          .query("workoutExercises")
          .withIndex("by_workout", (q) => q.eq("workoutId", workout._id))
          .collect();

        // Sort by order
        const sortedExercises = workoutExercises.sort(
          (a, b) => a.order - b.order
        );

        // Get exercise details
        const exercisesWithDetails = await Promise.all(
          sortedExercises.map(async (we) => {
            const exercise = await ctx.db.get(we.exerciseId);
            return { ...we, exercise };
          })
        );

        return { ...workout, exercises: exercisesWithDetails };
      })
    );

    // Sort workouts by order
    const sortedWorkouts = workoutsWithExercises.sort((a, b) => a.order - b.order);

    return {
      ...plan,
      workouts: sortedWorkouts,
    };
  },
});

/**
 * List all shared workout plans (public, no auth required)
 */
export const listShared = query({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db
      .query("workoutPlans")
      .withIndex("by_shared", (q) => q.eq("isShared", true))
      .order("desc")
      .collect();

    return plans;
  },
});

/**
 * Get a specific shared workout plan by ID (public)
 */
export const getSharedById = query({
  args: { id: v.id("workoutPlans") },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.id);
    
    if (!plan || !plan.isShared) {
      return null;
    }

    return plan;
  },
});

/**
 * Get a specific shared workout plan by slug (public)
 */
export const getSharedBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    // Use index to find shared plan by slug
    const plan = await ctx.db
      .query("workoutPlans")
      .withIndex("by_shared_and_slug", (q) =>
        q.eq("isShared", true).eq("slug", args.slug)
      )
      .first();
    
    return plan || null;
  },
});

/**
 * Get a shared workout plan with all its workouts and exercises by slug (public)
 */
export const getSharedWithWorkouts = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    // Get shared plan by slug using index
    const plan = await ctx.db
      .query("workoutPlans")
      .withIndex("by_shared_and_slug", (q) =>
        q.eq("isShared", true).eq("slug", args.slug)
      )
      .first();
    
    if (!plan) return null;

    // Get related workouts
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .collect();

    // Get exercises for each workout
    const workoutsWithExercises = await Promise.all(
      workouts.map(async (workout) => {
        const workoutExercises = await ctx.db
          .query("workoutExercises")
          .withIndex("by_workout", (q) => q.eq("workoutId", workout._id))
          .collect();

        // Sort by order
        const sortedExercises = workoutExercises.sort(
          (a, b) => a.order - b.order
        );

        // Get exercise details
        const exercisesWithDetails = await Promise.all(
          sortedExercises.map(async (we) => {
            const exercise = await ctx.db.get(we.exerciseId);
            return { ...we, exercise };
          })
        );

        return { ...workout, exercises: exercisesWithDetails };
      })
    );

    // Sort workouts by order
    const sortedWorkouts = workoutsWithExercises.sort((a, b) => a.order - b.order);

    return {
      ...plan,
      workouts: sortedWorkouts,
    };
  },
});

/**
 * Get a shared workout plan with all its workouts and exercises by ID (public)
 */
export const getSharedWithWorkoutsById = query({
  args: { id: v.id("workoutPlans") },
  handler: async (ctx, args) => {
    // Get plan
    const plan = await ctx.db.get(args.id);
    if (!plan || !plan.isShared) {
      return null;
    }

    // Get related workouts
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_plan", (q) => q.eq("planId", args.id))
      .collect();

    // Get exercises for each workout
    const workoutsWithExercises = await Promise.all(
      workouts.map(async (workout) => {
        const workoutExercises = await ctx.db
          .query("workoutExercises")
          .withIndex("by_workout", (q) => q.eq("workoutId", workout._id))
          .collect();

        // Sort by order
        const sortedExercises = workoutExercises.sort(
          (a, b) => a.order - b.order
        );

        // Get exercise details
        const exercisesWithDetails = await Promise.all(
          sortedExercises.map(async (we) => {
            const exercise = await ctx.db.get(we.exerciseId);
            return { ...we, exercise };
          })
        );

        return { ...workout, exercises: exercisesWithDetails };
      })
    );

    // Sort workouts by order
    const sortedWorkouts = workoutsWithExercises.sort((a, b) => a.order - b.order);

    return {
      ...plan,
      workouts: sortedWorkouts,
    };
  },
});

/**
 * Get the next incomplete workout for an active plan
 * Returns the first workout that hasn't been completed, or cycles back to workout 1
 */
export const getNextIncompleteWorkout = query({
  args: { planId: v.id("workoutPlans") },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return null;

    // Get plan
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== userId) {
      return null;
    }

    // Get all workouts for this plan, sorted by workoutNumber
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_plan", (q) => q.eq("planId", args.planId))
      .collect();

    if (workouts.length === 0) {
      return null;
    }

    // Sort by workoutNumber
    const sortedWorkouts = workouts.sort((a, b) => a.workoutNumber - b.workoutNumber);

    // Get all completed workout logs for this plan
    const completedLogs = await ctx.db
      .query("workoutLogs")
      .withIndex("by_user_and_plan_and_status", (q) =>
        q.eq("userId", userId).eq("planId", args.planId).eq("status", "completed")
      )
      .collect();

    // Sort completed logs by creation time (most recent first)
    // Use _creationTime as it's guaranteed to be unique, unlike completedAt which might be the same for rapid skips
    const sortedCompletedLogs = completedLogs
      .filter((log) => log.workoutId)
      .sort((a, b) => b._creationTime - a._creationTime);

    // Create a set of completed workout IDs
    const completedWorkoutIds = new Set(
      completedLogs
        .filter((log) => log.workoutId)
        .map((log) => log.workoutId as string)
    );

    // Find the first incomplete workout
    for (const workout of sortedWorkouts) {
      if (!completedWorkoutIds.has(workout._id)) {
        // Get exercises for this workout
        const workoutExercises = await ctx.db
          .query("workoutExercises")
          .withIndex("by_workout", (q) => q.eq("workoutId", workout._id))
          .collect();

        const sortedExercises = workoutExercises.sort((a, b) => a.order - b.order);

        const exercisesWithDetails = await Promise.all(
          sortedExercises.map(async (we) => {
            const exercise = await ctx.db.get(we.exerciseId);
            return { ...we, exercise };
          })
        );

        return {
          ...workout,
          plan,
          exercises: exercisesWithDetails,
          // Include timestamp to ensure React detects changes
          _lastCompletedAt: 0, // No completions yet
        };
      }
    }

    // All workouts completed, find the most recently completed one and cycle to the next
    let workoutToReturn = sortedWorkouts[0]; // Default to first workout
    let mostRecentCompletionTime = 0;
    
    if (sortedCompletedLogs.length > 0) {
      // Find the most recently completed workout
      const mostRecentLog = sortedCompletedLogs[0];
      mostRecentCompletionTime = mostRecentLog._creationTime;
      if (mostRecentLog.workoutId) {
        // Find the index of the most recently completed workout
        const lastCompletedIndex = sortedWorkouts.findIndex(
          (w) => w._id === mostRecentLog.workoutId
        );
        
        if (lastCompletedIndex !== -1) {
          // Get the next workout (cycle back to first if we're at the last one)
          const nextIndex = (lastCompletedIndex + 1) % sortedWorkouts.length;
          workoutToReturn = sortedWorkouts[nextIndex];
        }
      }
    }
    
    const firstWorkout = workoutToReturn;
    const workoutExercises = await ctx.db
      .query("workoutExercises")
      .withIndex("by_workout", (q) => q.eq("workoutId", firstWorkout._id))
      .collect();

    const sortedExercises = workoutExercises.sort((a, b) => a.order - b.order);

    const exercisesWithDetails = await Promise.all(
      sortedExercises.map(async (we) => {
        const exercise = await ctx.db.get(we.exerciseId);
        return { ...we, exercise };
      })
    );

    return {
      ...firstWorkout,
      plan,
      exercises: exercisesWithDetails,
      // Include the most recent completion time to ensure React detects changes
      // This changes every time a workout is skipped, forcing a re-render
      _lastCompletedAt: mostRecentCompletionTime,
    };
  },
});

/**
 * Share a workout plan with the community
 */
export const share = mutation({
  args: { id: v.id("workoutPlans") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const identity = await requireAuth(ctx);

    // Get existing plan
    const plan = await ctx.db.get(args.id);
    if (!plan) {
      throw new Error("Workout plan not found");
    }

    // Verify ownership
    if (plan.userId !== userId) {
      throw new Error("Not authorized to share this plan");
    }

    // Check if already shared (handle undefined as false for backward compatibility)
    if (plan.isShared === true) {
      throw new Error("Plan is already shared");
    }

    // Check if name is unique globally among shared plans
    const existingSharedPlan = await ctx.db
      .query("workoutPlans")
      .withIndex("by_shared_name", (q) =>
        q.eq("isShared", true).eq("name", plan.name)
      )
      .first();

    if (existingSharedPlan) {
      const username = identity.name || "User";
      const suggestedName = `${plan.name}-${username}`;
      throw new Error(
        `A shared plan with this name already exists. Suggested name: ${suggestedName}`
      );
    }

    // Share the plan (initialize likeCount and copyCount to 0 if not already set)
    const currentLikeCount = plan.likeCount ?? 0;
    const currentCopyCount = plan.copyCount ?? 0;
    await ctx.db.patch(args.id, {
      isShared: true,
      sharedByName: identity.name || undefined,
      likeCount: currentLikeCount,
      copyCount: currentCopyCount,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

/**
 * Unshare a workout plan
 */
export const unshare = mutation({
  args: { id: v.id("workoutPlans") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get existing plan
    const plan = await ctx.db.get(args.id);
    if (!plan) {
      throw new Error("Workout plan not found");
    }

    // Verify ownership
    if (plan.userId !== userId) {
      throw new Error("Not authorized to unshare this plan");
    }

    // Check if not shared
    if (!plan.isShared) {
      throw new Error("Plan is not shared");
    }

    // Unshare the plan
    await ctx.db.patch(args.id, {
      isShared: false,
      sharedByName: undefined,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

/**
 * Copy a shared workout plan to user's account
 */
export const copySharedPlan = mutation({
  args: {
    sharedPlanId: v.id("workoutPlans"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Validate name
    if (args.name.length < 3 || args.name.length > 100) {
      throw new Error("Name must be between 3 and 100 characters");
    }

    // Get shared plan
    const sharedPlan = await ctx.db.get(args.sharedPlanId);
    if (!sharedPlan || !sharedPlan.isShared) {
      throw new Error("Shared workout plan not found");
    }

    // Check if user already has a plan with this name
    const existingPlan = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const nameConflict = existingPlan.find((p) => p.name === args.name);
    if (nameConflict) {
      throw new Error(
        `You already have a plan with this name. Please choose a different name.`
      );
    }

    // Generate unique slug for the new plan
    let baseSlug = slugify(args.name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existingPlanWithSlug = existingPlan.find((p) => p.slug === slug);
      if (!existingPlanWithSlug) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Increment copy count for the shared plan
    const currentCopyCount = sharedPlan.copyCount || 0;
    await ctx.db.patch(args.sharedPlanId, {
      copyCount: currentCopyCount + 1,
      updatedAt: Date.now(),
    });

    // Create new private plan
    const newPlanId = await ctx.db.insert("workoutPlans", {
      userId,
      name: args.name,
      slug,
      description: sharedPlan.description,
      workoutsPerWeek: sharedPlan.workoutsPerWeek,
      isActive: false,
      isShared: false,
      sharedByName: undefined,
      likeCount: undefined,
      copyCount: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Get all workouts from shared plan
    const sharedWorkouts = await ctx.db
      .query("workouts")
      .withIndex("by_plan", (q) => q.eq("planId", args.sharedPlanId))
      .collect();

    // Sort workouts by order
    const sortedWorkouts = sharedWorkouts.sort((a, b) => a.order - b.order);

    // Copy workouts and exercises
    for (let i = 0; i < sortedWorkouts.length; i++) {
      const sharedWorkout = sortedWorkouts[i];
      
      // Create new workout
      const newWorkoutId = await ctx.db.insert("workouts", {
        planId: newPlanId,
        userId,
        name: sharedWorkout.name,
        workoutNumber: i + 1,
        order: i + 1,
        isTemplate: false,
        completionCount: 0,
        createdAt: Date.now(),
      });

      // Get exercises for this workout
      const workoutExercises = await ctx.db
        .query("workoutExercises")
        .withIndex("by_workout", (q) => q.eq("workoutId", sharedWorkout._id))
        .collect();

      // Sort exercises by order
      const sortedExercises = workoutExercises.sort((a, b) => a.order - b.order);

      // Copy exercises
      for (const exercise of sortedExercises) {
        await ctx.db.insert("workoutExercises", {
          workoutId: newWorkoutId,
          exerciseId: exercise.exerciseId,
          order: exercise.order,
          sets: exercise.sets,
          reps: exercise.reps,
          weight: exercise.weight,
          restTime: exercise.restTime,
          supersetWith: undefined, // Reset superset relationships
        });
      }
    }

    return { id: newPlanId, slug };
  },
});

/**
 * Create a new workout plan
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    workoutsPerWeek: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Validate input
    if (args.name.length < 3 || args.name.length > 100) {
      throw new Error("Name must be between 3 and 100 characters");
    }

    if (args.workoutsPerWeek < 1 || args.workoutsPerWeek > 10) {
      throw new Error("Workouts per week must be between 1 and 10");
    }

    if (args.description && args.description.length > 500) {
      throw new Error("Description must be less than 500 characters");
    }

    // Generate unique slug
    let baseSlug = slugify(args.name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    // Check if slug already exists for this user
    while (true) {
      const existingPlan = await ctx.db
        .query("workoutPlans")
        .withIndex("by_user_and_slug", (q) =>
          q.eq("userId", userId).eq("slug", slug)
        )
        .first();

      if (!existingPlan) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create plan
    const planId = await ctx.db.insert("workoutPlans", {
      userId,
      name: args.name,
      slug,
      description: args.description,
      workoutsPerWeek: args.workoutsPerWeek,
      isActive: false, // Not active by default
      isShared: false, // Not shared by default
      sharedByName: undefined,
      likeCount: undefined, // Not needed for private plans
      copyCount: undefined, // Not needed for private plans
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { id: planId, slug };
  },
});

/**
 * Update a workout plan
 */
export const update = mutation({
  args: {
    id: v.id("workoutPlans"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    workoutsPerWeek: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get existing plan
    const plan = await ctx.db.get(args.id);
    if (!plan) {
      throw new Error("Workout plan not found");
    }

    // Verify ownership
    if (plan.userId !== userId) {
      throw new Error("Not authorized to update this plan");
    }

    // If plan is shared, only the original owner can edit
    if (plan.isShared && plan.userId !== userId) {
      throw new Error("Only the original creator can edit shared plans");
    }

    // Validate updates
    if (args.name && (args.name.length < 3 || args.name.length > 100)) {
      throw new Error("Name must be between 3 and 100 characters");
    }

    if (args.workoutsPerWeek && (args.workoutsPerWeek < 1 || args.workoutsPerWeek > 10)) {
      throw new Error("Workouts per week must be between 1 and 10");
    }

    if (args.description && args.description.length > 500) {
      throw new Error("Description must be less than 500 characters");
    }

    // If updating name of a shared plan, check for uniqueness
    if (plan.isShared && args.name !== undefined && args.name !== plan.name) {
      const newName = args.name; // TypeScript type narrowing
      const existingSharedPlan = await ctx.db
        .query("workoutPlans")
        .withIndex("by_shared_name", (q) =>
          q.eq("isShared", true).eq("name", newName)
        )
        .first();

      if (existingSharedPlan && existingSharedPlan._id !== args.id) {
        const identity = await requireAuth(ctx);
        const username = identity.name || "User";
        const suggestedName = `${args.name}-${username}`;
        throw new Error(
          `A shared plan with this name already exists. Suggested name: ${suggestedName}`
        );
      }
    }

    // Apply updates
    const updates: {
      updatedAt: number;
      name?: string;
      slug?: string;
      description?: string;
      workoutsPerWeek?: number;
    } = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      updates.name = args.name;

      // Regenerate slug if name changed
      let baseSlug = slugify(args.name, { lower: true, strict: true });
      let slug = baseSlug;
      let counter = 1;

      // Check if slug already exists for this user (excluding current plan)
      while (true) {
        const existingPlan = await ctx.db
          .query("workoutPlans")
          .withIndex("by_user_and_slug", (q) =>
            q.eq("userId", userId).eq("slug", slug)
          )
          .first();

        if (!existingPlan || existingPlan._id === args.id) break;

        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      updates.slug = slug;
    }
    if (args.description !== undefined) updates.description = args.description;
    if (args.workoutsPerWeek !== undefined) updates.workoutsPerWeek = args.workoutsPerWeek;

    await ctx.db.patch(args.id, updates);

    return args.id;
  },
});

/**
 * Activate a workout plan (deactivates all others)
 */
export const activate = mutation({
  args: { id: v.id("workoutPlans") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get plan to activate
    const plan = await ctx.db.get(args.id);
    if (!plan || plan.userId !== userId) {
      throw new Error("Workout plan not found");
    }

    // Deactivate all other plans
    const allPlans = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const otherPlan of allPlans) {
      if (otherPlan._id !== args.id && otherPlan.isActive) {
        await ctx.db.patch(otherPlan._id, {
          isActive: false,
          updatedAt: Date.now(),
        });
      }
    }

    // Activate selected plan
    await ctx.db.patch(args.id, {
      isActive: true,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

/**
 * Deactivate a workout plan
 */
export const deactivate = mutation({
  args: { id: v.id("workoutPlans") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get plan
    const plan = await ctx.db.get(args.id);
    if (!plan || plan.userId !== userId) {
      throw new Error("Workout plan not found");
    }

    // Deactivate plan
    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

/**
 * Delete a workout plan (cascades to workouts and workout exercises)
 */
export const remove = mutation({
  args: { id: v.id("workoutPlans") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get and verify ownership
    const plan = await ctx.db.get(args.id);
    if (!plan) {
      throw new Error("Workout plan not found");
    }

    if (plan.userId !== userId) {
      throw new Error("Not authorized to delete this plan");
    }

    // Cascade delete workouts
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_plan", (q) => q.eq("planId", args.id))
      .collect();

    for (const workout of workouts) {
      // Delete workout exercises
      const exercises = await ctx.db
        .query("workoutExercises")
        .withIndex("by_workout", (q) => q.eq("workoutId", workout._id))
        .collect();

      for (const exercise of exercises) {
        await ctx.db.delete(exercise._id);
      }

      // Delete workout
      await ctx.db.delete(workout._id);
    }

    // Delete plan
    await ctx.db.delete(args.id);
  },
});

/**
 * Check if the current user has liked a shared workout plan
 */
export const hasLikedPlan = query({
  args: { planId: v.id("workoutPlans") },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return false;

    // Check if plan exists and is shared
    const plan = await ctx.db.get(args.planId);
    if (!plan || !plan.isShared) {
      return false;
    }

    // Check if user has liked this plan
    const like = await ctx.db
      .query("planLikes")
      .withIndex("by_plan_and_user", (q) =>
        q.eq("planId", args.planId).eq("userId", userId)
      )
      .first();

    return !!like;
  },
});

/**
 * Like or unlike a shared workout plan
 */
export const likePlan = mutation({
  args: { planId: v.id("workoutPlans") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get plan
    const plan = await ctx.db.get(args.planId);
    if (!plan || !plan.isShared) {
      throw new Error("Shared workout plan not found");
    }

    // Check if user already liked this plan
    const existingLike = await ctx.db
      .query("planLikes")
      .withIndex("by_plan_and_user", (q) =>
        q.eq("planId", args.planId).eq("userId", userId)
      )
      .first();

    const currentLikeCount = plan.likeCount || 0;

    if (existingLike) {
      // Unlike: remove the like and decrement count
      await ctx.db.delete(existingLike._id);
      await ctx.db.patch(args.planId, {
        likeCount: Math.max(0, currentLikeCount - 1),
        updatedAt: Date.now(),
      });
      return { liked: false, likeCount: Math.max(0, currentLikeCount - 1) };
    } else {
      // Like: add the like and increment count
      await ctx.db.insert("planLikes", {
        planId: args.planId,
        userId,
        createdAt: Date.now(),
      });
      await ctx.db.patch(args.planId, {
        likeCount: currentLikeCount + 1,
        updatedAt: Date.now(),
      });
      return { liked: true, likeCount: currentLikeCount + 1 };
    }
  },
});

/**
 * Create a workout plan from AI-generated data
 * This is used to save AI-generated workout plans
 */
export const createFromAI = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    workoutsPerWeek: v.number(),
    workouts: v.array(
      v.object({
        name: v.string(),
        exercises: v.array(
          v.object({
            exerciseName: v.string(),
            sets: v.number(),
            reps: v.number(),
            weight: v.number(),
            restTime: v.number(),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Validate input
    if (args.name.length < 3 || args.name.length > 100) {
      throw new Error("Name must be between 3 and 100 characters");
    }

    if (args.workoutsPerWeek < 1 || args.workoutsPerWeek > 10) {
      throw new Error("Workouts per week must be between 1 and 10");
    }

    if (args.description && args.description.length > 500) {
      throw new Error("Description must be less than 500 characters");
    }

    if (args.workouts.length === 0) {
      throw new Error("Plan must have at least one workout");
    }

    if (args.workouts.length > args.workoutsPerWeek) {
      throw new Error(
        `Cannot have more workouts (${args.workouts.length}) than workouts per week (${args.workoutsPerWeek})`
      );
    }

    // Get all exercises to map names to IDs
    const allExercises = await ctx.db.query("exercises").collect();
    const exerciseMap = new Map(allExercises.map((e) => [e.name, e._id]));

    // Validate all exercises exist
    for (const workout of args.workouts) {
      for (const exercise of workout.exercises) {
        if (!exerciseMap.has(exercise.exerciseName)) {
          throw new Error(
            `Exercise "${exercise.exerciseName}" not found in database`
          );
        }
      }
    }

    // Generate unique slug
    let baseSlug = slugify(args.name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existingPlan = await ctx.db
        .query("workoutPlans")
        .withIndex("by_user_and_slug", (q) =>
          q.eq("userId", userId).eq("slug", slug)
        )
        .first();

      if (!existingPlan) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create plan
    const planId = await ctx.db.insert("workoutPlans", {
      userId,
      name: args.name,
      slug,
      description: args.description,
      workoutsPerWeek: args.workoutsPerWeek,
      isActive: false,
      isShared: false,
      sharedByName: undefined,
      likeCount: undefined,
      copyCount: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create workouts and exercises
    for (let i = 0; i < args.workouts.length; i++) {
      const workoutData = args.workouts[i];

      // Create workout
      const workoutId = await ctx.db.insert("workouts", {
        planId,
        userId,
        name: workoutData.name,
        workoutNumber: i + 1,
        order: i + 1,
        isTemplate: false,
        completionCount: 0,
        createdAt: Date.now(),
      });

      // Create workout exercises
      for (let j = 0; j < workoutData.exercises.length; j++) {
        const exerciseData = workoutData.exercises[j];
        const exerciseId = exerciseMap.get(exerciseData.exerciseName);

        if (!exerciseId) {
          throw new Error(
            `Exercise "${exerciseData.exerciseName}" not found (this should not happen)`
          );
        }

        await ctx.db.insert("workoutExercises", {
          workoutId,
          exerciseId,
          order: j + 1,
          sets: exerciseData.sets,
          reps: exerciseData.reps,
          weight: exerciseData.weight,
          restTime: exerciseData.restTime,
          supersetWith: undefined,
        });
      }
    }

    return { id: planId, slug };
  },
});

/**
 * Migration: Add isShared field to all existing workout plans
 * Run this once to fix existing documents that don't have isShared field
 */
export const migrateAddIsShared = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all workout plans
    const plans = await ctx.db.query("workoutPlans").collect();
    
    let updated = 0;
    for (const plan of plans) {
      // Only update plans that don't have isShared field
      if (plan.isShared === undefined) {
        await ctx.db.patch(plan._id, {
          isShared: false,
          updatedAt: Date.now(),
        });
        updated++;
      }
    }
    
    return { updated, total: plans.length };
  },
});

