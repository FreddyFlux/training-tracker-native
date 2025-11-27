import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getUserId, getUserIdOrNull } from "./auth";
import type { Doc } from "./_generated/dataModel";

/**
 * Get all workout logs for the authenticated user
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return [];

    const logsQuery = ctx.db
      .query("workoutLogs")
      .withIndex("by_user_and_started", (q) => q.eq("userId", userId))
      .order("desc");

    const logs = args.limit
      ? await logsQuery.take(args.limit)
      : await logsQuery.collect();

    return logs;
  },
});

/**
 * Get all workout logs with exercise details for filtering and sorting
 */
export const listWithDetails = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return [];

    const logs = await ctx.db
      .query("workoutLogs")
      .withIndex("by_user_and_started", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Get sets and exercises for each log
    const logsWithDetails = await Promise.all(
      logs.map(async (log) => {
        const sets = await ctx.db
          .query("setLogs")
          .withIndex("by_workout_log", (q) => q.eq("workoutLogId", log._id))
          .collect();

        // Get exercise details for each set
        const setsWithExercises = await Promise.all(
          sets.map(async (set) => {
            const exercise = await ctx.db.get(set.exerciseId);
            return { ...set, exercise };
          })
        );

        return {
          ...log,
          sets: setsWithExercises,
        };
      })
    );

    return logsWithDetails;
  },
});

/**
 * Get the active (in-progress) workout log
 */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return null;

    const log = await ctx.db
      .query("workoutLogs")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", userId).eq("status", "in_progress")
      )
      .first();

    if (!log) return null;

    // Get completed sets
    const sets = await ctx.db
      .query("setLogs")
      .withIndex("by_workout_log", (q) => q.eq("workoutLogId", log._id))
      .collect();

    // Get exercises with details
    const setsWithExercises = await Promise.all(
      sets.map(async (set) => {
        const exercise = await ctx.db.get(set.exerciseId);
        return { ...set, exercise };
      })
    );

    return { ...log, completedSets: setsWithExercises };
  },
});

/**
 * Get the active workout log with full workout and exercise details
 */
export const getActiveWithDetails = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return null;

    const log = await ctx.db
      .query("workoutLogs")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", userId).eq("status", "in_progress")
      )
      .first();

    if (!log) return null;

    // Get the workout template if it exists
    let workout: (Doc<"workouts"> & { exercises?: Array<Doc<"workoutExercises"> & { exercise: Doc<"exercises"> | null }> }) | null = null;
    if (log.workoutId) {
      const workoutDoc = await ctx.db.get(log.workoutId);
      if (workoutDoc) {
        // Get workout exercises
        const workoutExercises = await ctx.db
          .query("workoutExercises")
          .withIndex("by_workout", (q) => q.eq("workoutId", workoutDoc._id))
          .collect();

        const sortedExercises = workoutExercises.sort((a, b) => a.order - b.order);

        const exercisesWithDetails = await Promise.all(
          sortedExercises.map(async (we) => {
            const exercise = await ctx.db.get(we.exerciseId);
            return { ...we, exercise };
          })
        );

        workout = { ...workoutDoc, exercises: exercisesWithDetails };
      }
    }

    // Get completed sets, organized by exercise
    const sets = await ctx.db
      .query("setLogs")
      .withIndex("by_workout_log", (q) => q.eq("workoutLogId", log._id))
      .collect();

    // Group sets by exerciseId
    const setsByExercise = new Map<string, typeof sets>();
    for (const set of sets) {
      const exerciseId = set.exerciseId;
      if (!setsByExercise.has(exerciseId)) {
        setsByExercise.set(exerciseId, []);
      }
      setsByExercise.get(exerciseId)!.push(set);
    }

    // Sort sets within each exercise by setNumber
    for (const [exerciseId, exerciseSets] of setsByExercise.entries()) {
      exerciseSets.sort((a, b) => a.setNumber - b.setNumber);
    }

    // Get plan slug if planId exists
    let planSlug: string | null = null;
    if (log.planId) {
      const plan = await ctx.db.get(log.planId);
      if (plan) {
        planSlug = plan.slug;
      }
    }

    return {
      ...log,
      workout,
      setsByExercise: Object.fromEntries(setsByExercise),
      planSlug,
    };
  },
});

/**
 * Get a specific workout log by ID
 */
export const getById = query({
  args: { id: v.id("workoutLogs") },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return null;

    const log = await ctx.db.get(args.id);

    // Verify ownership
    if (!log || log.userId !== userId) {
      return null;
    }

    // Get sets
    const sets = await ctx.db
      .query("setLogs")
      .withIndex("by_workout_log", (q) => q.eq("workoutLogId", args.id))
      .collect();

    // Get exercises with details
    const setsWithExercises = await Promise.all(
      sets.map(async (set) => {
        const exercise = await ctx.db.get(set.exerciseId);
        return { ...set, exercise };
      })
    );

    // Group sets by exerciseId for better organization
    const setsByExercise = new Map<string, typeof setsWithExercises>();
    for (const set of setsWithExercises) {
      const exerciseId = set.exerciseId;
      if (!setsByExercise.has(exerciseId)) {
        setsByExercise.set(exerciseId, []);
      }
      setsByExercise.get(exerciseId)!.push(set);
    }

    // Sort sets within each exercise by setNumber
    for (const [exerciseId, exerciseSets] of setsByExercise.entries()) {
      exerciseSets.sort((a, b) => a.setNumber - b.setNumber);
    }

    return { 
      ...log, 
      sets: setsWithExercises,
      setsByExercise: Object.fromEntries(setsByExercise),
    };
  },
});

/**
 * Get workout logs by plan
 */
export const getByPlan = query({
  args: { planId: v.id("workoutPlans") },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return [];

    // Verify plan ownership
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== userId) {
      return [];
    }

    const logs = await ctx.db
      .query("workoutLogs")
      .withIndex("by_user_and_plan", (q) =>
        q.eq("userId", userId).eq("planId", args.planId)
      )
      .order("desc")
      .collect();

    return logs;
  },
});

/**
 * Get completed workout count for a plan
 */
export const getCompletedCountByPlan = query({
  args: { planId: v.id("workoutPlans") },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return 0;

    // Verify plan ownership
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== userId) {
      return 0;
    }

    const completedLogs = await ctx.db
      .query("workoutLogs")
      .withIndex("by_user_and_plan_and_status", (q) =>
        q.eq("userId", userId).eq("planId", args.planId).eq("status", "completed")
      )
      .collect();

    return completedLogs.length;
  },
});

/**
 * Get exercise history (all sets for a specific exercise)
 */
export const getExerciseHistory = query({
  args: {
    exerciseId: v.id("exercises"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return [];

    // Get all sets for this exercise
    const setsQuery = ctx.db
      .query("setLogs")
      .withIndex("by_exercise", (q) => q.eq("exerciseId", args.exerciseId))
      .order("desc");

    const sets = args.limit
      ? await setsQuery.take(args.limit)
      : await setsQuery.collect();

    // Filter by user ownership through workout logs
    const userSets = await Promise.all(
      sets.map(async (set) => {
        const log = await ctx.db.get(set.workoutLogId);
        if (log && log.userId === userId) {
          return { ...set, workoutLog: log };
        }
        return null;
      })
    );

    // Filter out null values
    return userSets.filter((set) => set !== null);
  },
});

/**
 * Start a new workout session
 */
export const start = mutation({
  args: {
    workoutId: v.optional(v.id("workouts")),
    planId: v.optional(v.id("workoutPlans")),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Validate input
    if (args.name.length < 2 || args.name.length > 100) {
      throw new Error("Name must be between 2 and 100 characters");
    }

    // Check if user already has an active workout
    const activeWorkout = await ctx.db
      .query("workoutLogs")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", userId).eq("status", "in_progress")
      )
      .first();

    if (activeWorkout) {
      throw new Error("You already have an active workout. Complete it first.");
    }

    // If workoutId is provided, verify ownership
    if (args.workoutId) {
      const workout = await ctx.db.get(args.workoutId);
      if (!workout || workout.userId !== userId) {
        throw new Error("Workout not found");
      }
    }

    // If planId is provided, verify ownership
    if (args.planId) {
      const plan = await ctx.db.get(args.planId);
      if (!plan || plan.userId !== userId) {
        throw new Error("Plan not found");
      }
    }

    // Create workout log
    const logId = await ctx.db.insert("workoutLogs", {
      userId,
      workoutId: args.workoutId,
      planId: args.planId,
      name: args.name,
      startedAt: Date.now(),
      status: "in_progress",
    });

    return logId;
  },
});

/**
 * Start a workout from a plan (uses the workout template)
 */
export const startFromPlan = mutation({
  args: {
    planId: v.id("workoutPlans"),
    workoutId: v.id("workouts"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify plan ownership
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== userId) {
      throw new Error("Plan not found");
    }

    // Verify workout belongs to plan and user
    const workout = await ctx.db.get(args.workoutId);
    if (!workout || workout.userId !== userId || workout.planId !== args.planId) {
      throw new Error("Workout not found");
    }

    // Check if user already has an active workout
    const activeWorkout = await ctx.db
      .query("workoutLogs")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", userId).eq("status", "in_progress")
      )
      .first();

    // If there's an active workout, automatically abandon it before starting the new one
    if (activeWorkout) {
      await ctx.db.patch(activeWorkout._id, {
        status: "abandoned",
      });
    }

    // Create workout log
    const logId = await ctx.db.insert("workoutLogs", {
      userId,
      workoutId: args.workoutId,
      planId: args.planId,
      sharedWorkoutId: workout.sharedWorkoutId,
      name: workout.name,
      startedAt: Date.now(),
      status: "in_progress",
    });

    return logId;
  },
});

/**
 * Log a set during a workout
 */
export const logSet = mutation({
  args: {
    workoutLogId: v.id("workoutLogs"),
    exerciseId: v.id("exercises"),
    setNumber: v.number(),
    weight: v.number(),
    reps: v.number(),
    skipped: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify workout log ownership
    const log = await ctx.db.get(args.workoutLogId);
    if (!log || log.userId !== userId) {
      throw new Error("Workout log not found");
    }

    // Check if workout is in progress
    if (log.status !== "in_progress") {
      throw new Error("Workout is not in progress");
    }

    // Verify exercise exists
    const exercise = await ctx.db.get(args.exerciseId);
    if (!exercise) {
      throw new Error("Exercise not found");
    }

    // Validate parameters
    if (args.setNumber < 1) {
      throw new Error("Set number must be at least 1");
    }

    if (!args.skipped) {
      if (args.weight < 0 || args.weight > 1000) {
        throw new Error("Weight must be between 0 and 1000kg");
      }

      if (args.reps < 1 || args.reps > 100) {
        throw new Error("Reps must be between 1 and 100");
      }
    }

    // Create set log
    const setLogId = await ctx.db.insert("setLogs", {
      workoutLogId: args.workoutLogId,
      exerciseId: args.exerciseId,
      setNumber: args.setNumber,
      weight: args.skipped ? 0 : args.weight,
      reps: args.skipped ? 0 : args.reps,
      completedAt: Date.now(),
      skipped: args.skipped || false,
    });

    return setLogId;
  },
});

/**
 * Update a set log (edit weight/reps)
 */
export const updateSet = mutation({
  args: {
    id: v.id("setLogs"),
    weight: v.optional(v.number()),
    reps: v.optional(v.number()),
    skipped: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get set log
    const setLog = await ctx.db.get(args.id);
    if (!setLog) {
      throw new Error("Set log not found");
    }

    // Verify workout log ownership
    const log = await ctx.db.get(setLog.workoutLogId);
    if (!log || log.userId !== userId) {
      throw new Error("Not authorized to update this set");
    }

    // Check if workout is in progress
    if (log.status !== "in_progress") {
      throw new Error("Cannot update sets of a completed workout");
    }

    // Validate updates
    if (args.weight !== undefined && (args.weight < 0 || args.weight > 1000)) {
      throw new Error("Weight must be between 0 and 1000kg");
    }

    if (args.reps !== undefined && (args.reps < 1 || args.reps > 100)) {
      throw new Error("Reps must be between 1 and 100");
    }

    // Apply updates
    const updates: {
      weight?: number;
      reps?: number;
      skipped?: boolean;
    } = {};
    if (args.weight !== undefined) updates.weight = args.weight;
    if (args.reps !== undefined) updates.reps = args.reps;
    if (args.skipped !== undefined) {
      updates.skipped = args.skipped;
      if (args.skipped) {
        updates.weight = 0;
        updates.reps = 0;
      }
    }

    await ctx.db.patch(args.id, updates);

    return args.id;
  },
});

/**
 * Delete a set log
 */
export const deleteSet = mutation({
  args: { id: v.id("setLogs") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get set log
    const setLog = await ctx.db.get(args.id);
    if (!setLog) {
      throw new Error("Set log not found");
    }

    // Verify workout log ownership
    const log = await ctx.db.get(setLog.workoutLogId);
    if (!log || log.userId !== userId) {
      throw new Error("Not authorized to delete this set");
    }

    // Check if workout is in progress
    if (log.status !== "in_progress") {
      throw new Error("Cannot delete sets of a completed workout");
    }

    // Delete set log
    await ctx.db.delete(args.id);
  },
});

/**
 * Complete a workout session
 */
export const complete = mutation({
  args: {
    id: v.id("workoutLogs"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get workout log
    const log = await ctx.db.get(args.id);
    if (!log || log.userId !== userId) {
      throw new Error("Workout log not found");
    }

    // Check if workout is in progress
    if (log.status !== "in_progress") {
      throw new Error("Workout is not in progress");
    }

    // Validate notes
    if (args.notes && args.notes.length > 1000) {
      throw new Error("Notes must be less than 1000 characters");
    }

    // Complete workout
    await ctx.db.patch(args.id, {
      completedAt: Date.now(),
      status: "completed",
      notes: args.notes,
    });

    // Increment completion count for the workout template if it exists
    if (log.workoutId) {
      const workout = await ctx.db.get(log.workoutId);
      if (workout) {
        await ctx.db.patch(log.workoutId, {
          completionCount: (workout.completionCount || 0) + 1,
        });

        // If workout is based on a shared workout, increment usage counter
        if (workout.sharedWorkoutId) {
          const sharedWorkout = await ctx.db.get(workout.sharedWorkoutId);
          if (sharedWorkout) {
            await ctx.db.patch(workout.sharedWorkoutId, {
              usageCounter: (sharedWorkout.usageCounter || 0) + 1,
            });
          }
        }
      }
    }

    // Also check if log has sharedWorkoutId directly
    if (log.sharedWorkoutId) {
      const sharedWorkout = await ctx.db.get(log.sharedWorkoutId);
      if (sharedWorkout) {
        await ctx.db.patch(log.sharedWorkoutId, {
          usageCounter: (sharedWorkout.usageCounter || 0) + 1,
        });
      }
    }

    return args.id;
  },
});

/**
 * Skip a workout (mark as completed without starting it)
 * This creates a completed workout log entry so the next workout becomes active
 */
export const skipWorkout = mutation({
  args: {
    planId: v.id("workoutPlans"),
    workoutId: v.id("workouts"),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify plan ownership
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== userId) {
      throw new Error("Plan not found");
    }

    // Verify workout belongs to plan and user
    const workout = await ctx.db.get(args.workoutId);
    if (!workout || workout.userId !== userId || workout.planId !== args.planId) {
      throw new Error("Workout not found");
    }

    // IMPORTANT: We always create a new log when skipping, even if one exists
    // This is necessary for proper cycling behavior - each skip should create a new log entry
    // so that getNextIncompleteWorkout can track the most recent completion

    // Create a completed workout log entry
    const now = Date.now();
    const logId = await ctx.db.insert("workoutLogs", {
      userId,
      workoutId: args.workoutId,
      planId: args.planId,
      name: workout.name,
      startedAt: now,
      completedAt: now,
      status: "completed",
      notes: "Skipped",
    });

    // Note: We don't increment completionCount for skipped workouts
    // Skipping should only shift to the next workout, not mark it as completed

    return logId;
  },
});

/**
 * Abandon a workout session
 */
export const abandon = mutation({
  args: { id: v.id("workoutLogs") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get workout log
    const log = await ctx.db.get(args.id);
    if (!log || log.userId !== userId) {
      throw new Error("Workout log not found");
    }

    // Check if workout is in progress
    if (log.status !== "in_progress") {
      throw new Error("Workout is not in progress");
    }

    // Abandon workout
    await ctx.db.patch(args.id, {
      status: "abandoned",
    });

    return args.id;
  },
});

/**
 * Delete a workout log (and all its sets)
 */
export const remove = mutation({
  args: { id: v.id("workoutLogs") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get workout log
    const log = await ctx.db.get(args.id);
    if (!log || log.userId !== userId) {
      throw new Error("Workout log not found");
    }

    // Delete all sets
    const sets = await ctx.db
      .query("setLogs")
      .withIndex("by_workout_log", (q) => q.eq("workoutLogId", args.id))
      .collect();

    for (const set of sets) {
      await ctx.db.delete(set._id);
    }

    // Delete workout log
    await ctx.db.delete(args.id);
  },
});

/**
 * Get dashboard statistics for the authenticated user
 */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) {
      return {
        totalWorkouts: 0,
        thisWeekWorkouts: 0,
        weeksStreak: 0,
      };
    }

    // Get all completed workout logs
    const allLogs = await ctx.db
      .query("workoutLogs")
      .withIndex("by_user_and_started", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const completedLogs = allLogs.filter((log) => log.status === "completed");

    // Total workouts
    const totalWorkouts = completedLogs.length;

    // This week's workouts
    const now = Date.now();
    const startOfWeek = new Date(now);
    startOfWeek.setUTCHours(0, 0, 0, 0);
    // Get Monday of current week (ISO week starts on Monday)
    const dayOfWeek = startOfWeek.getUTCDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to Monday
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() + diff);
    const startOfWeekTimestamp = startOfWeek.getTime();

    const thisWeekWorkouts = completedLogs.filter((log) => {
      const completedAt = log.completedAt || log.startedAt;
      return completedAt >= startOfWeekTimestamp;
    }).length;

    // Calculate weeks streak
    // Helper function to get Monday timestamp of the week (used as week identifier)
    const getWeekStartTimestamp = (timestamp: number): number => {
      const date = new Date(timestamp);
      date.setUTCHours(0, 0, 0, 0);
      
      // Get Monday of the week (ISO week starts on Monday)
      const dayOfWeek = date.getUTCDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      date.setUTCDate(date.getUTCDate() + diff);
      
      return date.getTime();
    };
    
    // Group completed workouts by week (using week start timestamp as identifier)
    const weeksWithWorkouts = new Set<number>();
    
    for (const log of completedLogs) {
      const completedAt = log.completedAt || log.startedAt;
      const weekStart = getWeekStartTimestamp(completedAt);
      weeksWithWorkouts.add(weekStart);
    }

    // Calculate consecutive weeks streak
    const sortedWeeks = Array.from(weeksWithWorkouts).sort((a, b) => b - a); // Most recent first
    
    if (sortedWeeks.length === 0) {
      return {
        totalWorkouts,
        thisWeekWorkouts,
        weeksStreak: 0,
      };
    }

    // Get current week start timestamp
    const currentWeekStart = getWeekStartTimestamp(now);
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    // Calculate streak: count consecutive weeks starting from the most recent week
    // The streak can start from current week or last week (if current week has no workouts)
    const mostRecentWeek = sortedWeeks[0];
    
    // If the most recent week is more than 1 week ago, there's no active streak
    if (mostRecentWeek < currentWeekStart - oneWeekMs) {
      return {
        totalWorkouts,
        thisWeekWorkouts,
        weeksStreak: 0,
      };
    }
    
    // Count consecutive weeks backwards
    let weeksStreak = 0;
    let expectedWeekStart = mostRecentWeek;
    
    for (const weekStart of sortedWeeks) {
      // Only count if this week matches what we expect
      if (weekStart === expectedWeekStart) {
        weeksStreak++;
        expectedWeekStart -= oneWeekMs; // Move to previous week
      } else if (weekStart < expectedWeekStart) {
        // We've passed the expected week, gap found - streak broken
        break;
      }
      // If weekStart > expectedWeekStart, skip (this shouldn't happen with sorted array, but safety check)
    }

    return {
      totalWorkouts,
      thisWeekWorkouts,
      weeksStreak,
    };
  },
});

/**
 * Get recent activity (recent completed workouts and sharing events)
 */
export const getRecentActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return [];

    const limit = args.limit || 5;

    // Get completed workout logs
    const logs = await ctx.db
      .query("workoutLogs")
      .withIndex("by_user_and_started", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const completedLogs = logs.filter((log) => log.status === "completed");

    // Get shared workouts created by the user
    const sharedWorkouts = await ctx.db
      .query("sharedWorkouts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Get shared workout plans created by the user
    const sharedPlans = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isShared"), true))
      .order("desc")
      .collect();

    // Combine all activities with type indicators
    const activities: Array<{
      type: "workout_log" | "shared_workout" | "shared_plan";
      _id: string;
      name: string;
      timestamp: number;
      sharedByName?: string;
      planId?: string;
      planSlug?: string;
      sharedWorkoutId?: string;
    }> = [];

    // Add workout logs
    for (const log of completedLogs) {
      let planSlug: string | undefined;
      if (log.planId) {
        const plan = await ctx.db.get(log.planId);
        if (plan && plan.userId === userId) {
          planSlug = plan.slug;
        }
      }
      activities.push({
        type: "workout_log",
        _id: log._id,
        name: log.name,
        timestamp: log.completedAt || log.startedAt,
        planId: log.planId,
        planSlug,
      });
    }

    // Add shared workouts
    for (const sharedWorkout of sharedWorkouts) {
      activities.push({
        type: "shared_workout",
        _id: sharedWorkout._id,
        name: sharedWorkout.name,
        timestamp: sharedWorkout.createdAt,
        sharedByName: sharedWorkout.sharedByName,
        sharedWorkoutId: sharedWorkout._id,
      });
    }

    // Add shared plans
    for (const plan of sharedPlans) {
      activities.push({
        type: "shared_plan",
        _id: plan._id,
        name: plan.name,
        timestamp: plan.updatedAt || plan.createdAt,
        sharedByName: plan.sharedByName,
        planSlug: plan.slug,
      });
    }

    // Sort by timestamp descending and take the most recent ones
    activities.sort((a, b) => b.timestamp - a.timestamp);
    return activities.slice(0, limit);
  },
});

