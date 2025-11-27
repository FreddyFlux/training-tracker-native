import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getUserId, getUserIdOrNull } from "./auth";
import type { Id } from "./_generated/dataModel";

/**
 * List all workouts for the authenticated user
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return [];

    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return workouts;
  },
});

/**
 * Get workouts by plan
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

    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_plan", (q) => q.eq("planId", args.planId))
      .collect();

    // Sort by order
    return workouts.sort((a, b) => a.order - b.order);
  },
});

/**
 * Get a specific workout with exercises
 */
export const getById = query({
  args: { id: v.id("workouts") },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return null;

    const workout = await ctx.db.get(args.id);

    // Verify ownership
    if (!workout || workout.userId !== userId) {
      return null;
    }

    // Get exercises
    const workoutExercises = await ctx.db
      .query("workoutExercises")
      .withIndex("by_workout", (q) => q.eq("workoutId", args.id))
      .collect();

    // Sort by order
    const sortedExercises = workoutExercises.sort((a, b) => a.order - b.order);

    // Get exercise details
    const exercisesWithDetails = await Promise.all(
      sortedExercises.map(async (we) => {
        const exercise = await ctx.db.get(we.exerciseId);
        return { ...we, exercise };
      })
    );

    return {
      ...workout,
      exercises: exercisesWithDetails,
    };
  },
});

/**
 * Get a specific workout by plan slug and workout number
 */
export const getByPlanSlugAndNumber = query({
  args: {
    planSlug: v.string(),
    workoutNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return null;

    // Get plan by slug
    const plan = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user_and_slug", (q) =>
        q.eq("userId", userId).eq("slug", args.planSlug)
      )
      .first();

    if (!plan) return null;

    // Get workout by plan and workout number
    const workout = await ctx.db
      .query("workouts")
      .withIndex("by_plan_and_workout_number", (q) =>
        q.eq("planId", plan._id).eq("workoutNumber", args.workoutNumber)
      )
      .first();

    if (!workout) return null;

    // Get exercises
    const workoutExercises = await ctx.db
      .query("workoutExercises")
      .withIndex("by_workout", (q) => q.eq("workoutId", workout._id))
      .collect();

    // Sort by order
    const sortedExercises = workoutExercises.sort((a, b) => a.order - b.order);

    // Get exercise details
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
    };
  },
});

/**
 * List user's workout templates
 */
export const listTemplates = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return [];

    const templates = await ctx.db
      .query("workouts")
      .withIndex("by_user_and_template", (q) =>
        q.eq("userId", userId).eq("isTemplate", true)
      )
      .order("desc")
      .collect();

    return templates;
  },
});

/**
 * Create a new workout
 */
export const create = mutation({
  args: {
    planId: v.optional(v.id("workoutPlans")),
    name: v.string(),
    order: v.optional(v.number()),
    isTemplate: v.optional(v.boolean()),
    sharedWorkoutId: v.optional(v.id("sharedWorkouts")),
    exercises: v.optional(
      v.array(
        v.object({
          exerciseId: v.id("exercises"),
          order: v.number(),
          sets: v.number(),
          reps: v.number(),
          weight: v.number(),
          restTime: v.number(),
          supersetWith: v.optional(v.string()), // "previous", "next", or exercise ID (will be resolved in handler)
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Validate input
    if (args.name.length < 2 || args.name.length > 100) {
      throw new Error("Name must be between 2 and 100 characters");
    }

    // If planId is provided, verify plan ownership and check workout limit
    if (args.planId) {
      const plan = await ctx.db.get(args.planId);
      if (!plan || plan.userId !== userId) {
        throw new Error("Plan not found");
      }

      // Check if we've reached the workouts per week limit
      const existingWorkoutsForPlan = await ctx.db
        .query("workouts")
        .withIndex("by_plan", (q) => q.eq("planId", args.planId))
        .collect();

      if (existingWorkoutsForPlan.length >= plan.workoutsPerWeek) {
        throw new Error(
          `Cannot create more workouts. This plan allows ${plan.workoutsPerWeek} workout${
            plan.workoutsPerWeek === 1 ? "" : "s"
          } per week.`
        );
      }
    }

    // Auto-generate workoutNumber if planId is provided
    let workoutNumber = 0;
    if (args.planId) {
      const existingWorkouts = await ctx.db
        .query("workouts")
        .withIndex("by_plan", (q) => q.eq("planId", args.planId))
        .collect();

      // Find the highest workout number and add 1
      workoutNumber = existingWorkouts.reduce(
        (max, w) => Math.max(max, w.workoutNumber || 0),
        0
      ) + 1;
    }

    // If sharedWorkoutId is provided, verify it exists
    if (args.sharedWorkoutId) {
      const sharedWorkout = await ctx.db.get(args.sharedWorkoutId);
      if (!sharedWorkout) {
        throw new Error("Shared workout not found");
      }
    }

    // Create workout
    const workoutId = await ctx.db.insert("workouts", {
      planId: args.planId,
      userId,
      name: args.name,
      workoutNumber,
      order: args.order || 0,
      isTemplate: args.isTemplate || false,
      completionCount: 0,
      sharedWorkoutId: args.sharedWorkoutId,
      createdAt: Date.now(),
    });

    // Increment usage counter for shared workout if used
    if (args.sharedWorkoutId) {
      const sharedWorkout = await ctx.db.get(args.sharedWorkoutId);
      if (sharedWorkout) {
        await ctx.db.patch(args.sharedWorkoutId, {
          usageCounter: (sharedWorkout.usageCounter || 0) + 1,
        });
      }
    }

    // Add exercises if provided
    if (args.exercises && args.exercises.length > 0) {
      // First pass: create all exercises without superset relationships
      const exerciseIds: Id<"workoutExercises">[] = [];
      for (const exercise of args.exercises) {
        // Verify exercise exists
        const exerciseExists = await ctx.db.get(exercise.exerciseId);
        if (!exerciseExists) {
          throw new Error(`Exercise ${exercise.exerciseId} not found`);
        }

        // Validate exercise parameters
        if (exercise.sets < 1 || exercise.sets > 10) {
          throw new Error("Sets must be between 1 and 10");
        }

        if (exercise.reps < 1 || exercise.reps > 100) {
          throw new Error("Reps must be between 1 and 100");
        }

        if (exercise.weight < 0 || exercise.weight > 1000) {
          throw new Error("Weight must be between 0 and 1000kg");
        }

        if (exercise.restTime < 0 || exercise.restTime > 600) {
          throw new Error("Rest time must be between 0 and 600 seconds");
        }

        const exerciseId = await ctx.db.insert("workoutExercises", {
          workoutId,
          exerciseId: exercise.exerciseId,
          order: exercise.order,
          sets: exercise.sets,
          reps: exercise.reps,
          weight: exercise.weight,
          restTime: exercise.restTime,
          supersetWith: undefined, // Will be set in second pass
        });
        exerciseIds.push(exerciseId);
      }

      // Second pass: update superset relationships
      for (let i = 0; i < args.exercises.length; i++) {
        const exercise = args.exercises[i];
        if (exercise.supersetWith) {
          let supersetIndex = -1;
          
          // Handle "previous" and "next" strings
          if (exercise.supersetWith === "previous") {
            supersetIndex = i - 1;
          } else if (exercise.supersetWith === "next") {
            supersetIndex = i + 1;
          } else {
            // Try to find by order (if passed as string number)
            const targetOrder = parseInt(exercise.supersetWith);
            if (!isNaN(targetOrder)) {
              supersetIndex = args.exercises.findIndex(e => e.order === targetOrder);
            }
          }
          
          if (supersetIndex >= 0 && supersetIndex < exerciseIds.length) {
            await ctx.db.patch(exerciseIds[i], { supersetWith: exerciseIds[supersetIndex] });
          }
        }
      }
    }

    return { id: workoutId, workoutNumber };
  },
});

/**
 * Update a workout
 */
export const update = mutation({
  args: {
    id: v.id("workouts"),
    name: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get existing workout
    const workout = await ctx.db.get(args.id);
    if (!workout) {
      throw new Error("Workout not found");
    }

    // Verify ownership
    if (workout.userId !== userId) {
      throw new Error("Not authorized to update this workout");
    }

    // Validate updates
    if (args.name && (args.name.length < 2 || args.name.length > 100)) {
      throw new Error("Name must be between 2 and 100 characters");
    }

    // Apply updates
    const updates: {
      name?: string;
      order?: number;
    } = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.order !== undefined) updates.order = args.order;

    await ctx.db.patch(args.id, updates);

    return args.id;
  },
});

/**
 * Add an exercise to a workout
 */
export const addExercise = mutation({
  args: {
    workoutId: v.id("workouts"),
    exerciseId: v.id("exercises"),
    order: v.number(),
    sets: v.number(),
    reps: v.number(),
    weight: v.number(),
    restTime: v.number(),
    supersetWith: v.optional(v.id("workoutExercises")),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify workout ownership
    const workout = await ctx.db.get(args.workoutId);
    if (!workout || workout.userId !== userId) {
      throw new Error("Workout not found");
    }

    // Verify exercise exists
    const exercise = await ctx.db.get(args.exerciseId);
    if (!exercise) {
      throw new Error("Exercise not found");
    }

    // Validate parameters
    if (args.sets < 1 || args.sets > 10) {
      throw new Error("Sets must be between 1 and 10");
    }

    if (args.reps < 1 || args.reps > 100) {
      throw new Error("Reps must be between 1 and 100");
    }

    if (args.weight < 0 || args.weight > 1000) {
      throw new Error("Weight must be between 0 and 1000kg");
    }

    if (args.restTime < 0 || args.restTime > 600) {
      throw new Error("Rest time must be between 0 and 600 seconds");
    }

    // Add exercise to workout
    const workoutExerciseId = await ctx.db.insert("workoutExercises", {
      workoutId: args.workoutId,
      exerciseId: args.exerciseId,
      order: args.order,
      sets: args.sets,
      reps: args.reps,
      weight: args.weight,
      restTime: args.restTime,
      supersetWith: args.supersetWith,
    });

    return workoutExerciseId;
  },
});

/**
 * Remove an exercise from a workout
 */
export const removeExercise = mutation({
  args: { id: v.id("workoutExercises") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get workout exercise
    const workoutExercise = await ctx.db.get(args.id);
    if (!workoutExercise) {
      throw new Error("Workout exercise not found");
    }

    // Verify workout ownership
    const workout = await ctx.db.get(workoutExercise.workoutId);
    if (!workout || workout.userId !== userId) {
      throw new Error("Not authorized to modify this workout");
    }

    // Delete workout exercise
    await ctx.db.delete(args.id);
  },
});

/**
 * Update a workout exercise
 */
export const updateExercise = mutation({
  args: {
    id: v.id("workoutExercises"),
    order: v.optional(v.number()),
    sets: v.optional(v.number()),
    reps: v.optional(v.number()),
    weight: v.optional(v.number()),
    restTime: v.optional(v.number()),
    supersetWith: v.optional(v.union(v.id("workoutExercises"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get workout exercise
    const workoutExercise = await ctx.db.get(args.id);
    if (!workoutExercise) {
      throw new Error("Workout exercise not found");
    }

    // Verify workout ownership
    const workout = await ctx.db.get(workoutExercise.workoutId);
    if (!workout || workout.userId !== userId) {
      throw new Error("Not authorized to modify this workout");
    }

    // If workout is based on a shared workout, increment usage counter when editing
    if (workout.sharedWorkoutId) {
      const sharedWorkout = await ctx.db.get(workout.sharedWorkoutId);
      if (sharedWorkout) {
        await ctx.db.patch(workout.sharedWorkoutId, {
          usageCounter: (sharedWorkout.usageCounter || 0) + 1,
        });
      }
    }

    // Validate updates
    if (args.sets && (args.sets < 1 || args.sets > 10)) {
      throw new Error("Sets must be between 1 and 10");
    }

    if (args.reps && (args.reps < 1 || args.reps > 100)) {
      throw new Error("Reps must be between 1 and 100");
    }

    if (args.weight !== undefined && (args.weight < 0 || args.weight > 1000)) {
      throw new Error("Weight must be between 0 and 1000kg");
    }

    if (
      args.restTime !== undefined &&
      (args.restTime < 0 || args.restTime > 600)
    ) {
      throw new Error("Rest time must be between 0 and 600 seconds");
    }

    // Apply updates
    const updates: {
      order?: number;
      sets?: number;
      reps?: number;
      weight?: number;
      restTime?: number;
      supersetWith?: Id<"workoutExercises"> | null;
    } = {};
    if (args.order !== undefined) updates.order = args.order;
    if (args.sets !== undefined) updates.sets = args.sets;
    if (args.reps !== undefined) updates.reps = args.reps;
    if (args.weight !== undefined) updates.weight = args.weight;
    if (args.restTime !== undefined) updates.restTime = args.restTime;
    if (args.supersetWith !== undefined) updates.supersetWith = args.supersetWith;

    await ctx.db.patch(args.id, updates);

    return args.id;
  },
});

/**
 * Save workout as template
 */
export const saveAsTemplate = mutation({
  args: { workoutId: v.id("workouts") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get existing workout
    const workout = await ctx.db.get(args.workoutId);
    if (!workout || workout.userId !== userId) {
      throw new Error("Workout not found");
    }

    // Get exercises
    const exercises = await ctx.db
      .query("workoutExercises")
      .withIndex("by_workout", (q) => q.eq("workoutId", args.workoutId))
      .collect();

    // Create template (copy workout)
    const templateId = await ctx.db.insert("workouts", {
      userId,
      name: `${workout.name} (Template)`,
      workoutNumber: 0, // Templates don't need a workout number
      isTemplate: true,
      order: 0,
      completionCount: 0,
      createdAt: Date.now(),
    });

    // Copy exercises (note: superset relationships won't be preserved in templates as IDs change)
    for (const exercise of exercises) {
      await ctx.db.insert("workoutExercises", {
        workoutId: templateId,
        exerciseId: exercise.exerciseId,
        order: exercise.order,
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        restTime: exercise.restTime,
        supersetWith: undefined, // Don't copy superset relationships to templates
      });
    }

    return templateId;
  },
});

/**
 * Copy template to plan
 */
export const copyTemplate = mutation({
  args: {
    templateId: v.id("workouts"),
    planId: v.id("workoutPlans"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Verify template exists and user has access
    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== userId || !template.isTemplate) {
      throw new Error("Template not found");
    }

    // Verify plan ownership
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== userId) {
      throw new Error("Plan not found");
    }

    // Auto-generate workoutNumber
    const existingWorkouts = await ctx.db
      .query("workouts")
      .withIndex("by_plan", (q) => q.eq("planId", args.planId))
      .collect();

    const workoutNumber = existingWorkouts.reduce(
      (max, w) => Math.max(max, w.workoutNumber || 0),
      0
    ) + 1;

    // Create workout from template
    const workoutId = await ctx.db.insert("workouts", {
      planId: args.planId,
      userId,
      name: args.name,
      workoutNumber,
      order: 0,
      isTemplate: false,
      completionCount: 0,
      createdAt: Date.now(),
    });

    // Copy exercises
    const exercises = await ctx.db
      .query("workoutExercises")
      .withIndex("by_workout", (q) => q.eq("workoutId", args.templateId))
      .collect();

    // First pass: create all exercises without superset relationships
    const exerciseIdMap = new Map<Id<"workoutExercises">, Id<"workoutExercises">>(); // oldId -> newId
    for (const exercise of exercises) {
      const newId = await ctx.db.insert("workoutExercises", {
        workoutId,
        exerciseId: exercise.exerciseId,
        order: exercise.order,
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        restTime: exercise.restTime,
        supersetWith: undefined, // Will be set in second pass
      });
      exerciseIdMap.set(exercise._id, newId);
    }
    
    // Second pass: update superset relationships with new IDs
    for (const exercise of exercises) {
      if (exercise.supersetWith) {
        const newId = exerciseIdMap.get(exercise._id);
        const newSupersetWithId = exerciseIdMap.get(exercise.supersetWith);
        if (newId && newSupersetWithId) {
          await ctx.db.patch(newId, { supersetWith: newSupersetWithId });
        }
      }
    }

    return workoutId;
  },
});

/**
 * Delete a workout and renumber subsequent workouts in the plan
 */
export const remove = mutation({
  args: { id: v.id("workouts") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get workout
    const workout = await ctx.db.get(args.id);
    if (!workout) {
      throw new Error("Workout not found");
    }

    // Verify ownership
    if (workout.userId !== userId) {
      throw new Error("Not authorized to delete this workout");
    }

    // Store planId and workoutNumber for renumbering
    const deletedWorkoutNumber = workout.workoutNumber;
    const planId = workout.planId;

    // Delete all workout exercises
    const exercises = await ctx.db
      .query("workoutExercises")
      .withIndex("by_workout", (q) => q.eq("workoutId", args.id))
      .collect();

    for (const exercise of exercises) {
      await ctx.db.delete(exercise._id);
    }

    // Delete workout
    await ctx.db.delete(args.id);

    // Renumber subsequent workouts in the plan (if part of a plan)
    if (planId) {
      // Get all workouts in the plan with higher workout numbers
      const subsequentWorkouts = await ctx.db
        .query("workouts")
        .withIndex("by_plan", (q) => q.eq("planId", planId))
        .filter((q) => q.gt(q.field("workoutNumber"), deletedWorkoutNumber))
        .collect();

      // Decrement workoutNumber for each subsequent workout
      for (const subsequentWorkout of subsequentWorkouts) {
        await ctx.db.patch(subsequentWorkout._id, {
          workoutNumber: subsequentWorkout.workoutNumber - 1,
        });
      }
    }
  },
});

