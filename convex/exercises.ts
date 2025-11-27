import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getUserId, getUserIdOrNull } from "./auth";

/**
 * List all exercises (global library)
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const exercises = await ctx.db.query("exercises").order("desc").collect();

    return exercises;
  },
});

/**
 * Get exercises by muscle group
 */
export const getByMuscleGroup = query({
  args: { muscleGroup: v.string() },
  handler: async (ctx, args) => {
    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_muscle_group", (q) =>
        q.eq("muscleGroup", args.muscleGroup)
      )
      .collect();

    return exercises;
  },
});

/**
 * Search exercises by name
 */
export const search = query({
  args: {
    query: v.string(),
    muscleGroup: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Full-text search with optional muscle group filter
    const results = await ctx.db
      .query("exercises")
      .withSearchIndex("search_name", (q) => {
        const searchQuery = q.search("name", args.query);
        if (args.muscleGroup) {
          return searchQuery.eq("muscleGroup", args.muscleGroup);
        }
        return searchQuery;
      })
      .collect();

    return results;
  },
});

/**
 * Get a specific exercise by ID
 */
export const getById = query({
  args: { id: v.id("exercises") },
  handler: async (ctx, args) => {
    const exercise = await ctx.db.get(args.id);
    return exercise;
  },
});

/**
 * Get exercises created by the authenticated user
 */
export const getMyExercises = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserIdOrNull(ctx);
    if (!userId) return [];

    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .order("desc")
      .collect();

    return exercises;
  },
});

/**
 * Create a new exercise
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    muscleGroup: v.string(),
    equipment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Validate input
    if (args.name.length < 2 || args.name.length > 100) {
      throw new Error("Name must be between 2 and 100 characters");
    }

    if (args.description && args.description.length > 500) {
      throw new Error("Description must be less than 500 characters");
    }

    // Validate muscle group
    const validMuscleGroups = [
      "chest",
      "back",
      "shoulders",
      "arms",
      "legs",
      "core",
      "cardio",
      "other",
    ];

    if (!validMuscleGroups.includes(args.muscleGroup)) {
      throw new Error("Invalid muscle group");
    }

    // Validate equipment
    if (args.equipment) {
      const validEquipmentTypes = [
        "machine",
        "dumbbell",
        "barbell",
        "bodyweight",
        "other",
      ];

      if (!validEquipmentTypes.includes(args.equipment)) {
        throw new Error("Invalid equipment type");
      }
    }

    // Check if exercise already exists (by name)
    const existing = await ctx.db
      .query("exercises")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      throw new Error("An exercise with this name already exists");
    }

    // Create exercise
    const exerciseId = await ctx.db.insert("exercises", {
      name: args.name,
      description: args.description,
      muscleGroup: args.muscleGroup,
      equipment: args.equipment,
      createdBy: userId,
      isVerified: false,
      createdAt: Date.now(),
    });

    return exerciseId;
  },
});

/**
 * Update an exercise (only by creator or admin)
 */
export const update = mutation({
  args: {
    id: v.id("exercises"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    muscleGroup: v.optional(v.string()),
    equipment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get existing exercise
    const exercise = await ctx.db.get(args.id);
    if (!exercise) {
      throw new Error("Exercise not found");
    }

    // Verify ownership (only creator can edit)
    if (exercise.createdBy !== userId) {
      throw new Error("Not authorized to update this exercise");
    }

    // Validate updates
    if (args.name && (args.name.length < 2 || args.name.length > 100)) {
      throw new Error("Name must be between 2 and 100 characters");
    }

    if (args.description && args.description.length > 500) {
      throw new Error("Description must be less than 500 characters");
    }

    if (args.muscleGroup) {
      const validMuscleGroups = [
        "chest",
        "back",
        "shoulders",
        "arms",
        "legs",
        "core",
        "cardio",
        "other",
      ];

      if (!validMuscleGroups.includes(args.muscleGroup)) {
        throw new Error("Invalid muscle group");
      }
    }

    // Validate equipment
    if (args.equipment) {
      const validEquipmentTypes = [
        "machine",
        "dumbbell",
        "barbell",
        "bodyweight",
        "other",
      ];

      if (!validEquipmentTypes.includes(args.equipment)) {
        throw new Error("Invalid equipment type");
      }
    }

    // Check if name is being changed and already exists
    if (args.name && args.name !== exercise.name) {
      const newName = args.name; // TypeScript type narrowing
      const existing = await ctx.db
        .query("exercises")
        .withIndex("by_name", (q) => q.eq("name", newName))
        .first();

      if (existing) {
        throw new Error("An exercise with this name already exists");
      }
    }

    // Apply updates
    const updates: {
      name?: string;
      description?: string;
      muscleGroup?: string;
      equipment?: string;
    } = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.muscleGroup !== undefined) updates.muscleGroup = args.muscleGroup;
    if (args.equipment !== undefined) updates.equipment = args.equipment;

    await ctx.db.patch(args.id, updates);

    return args.id;
  },
});

/**
 * Delete an exercise (only by creator, and only if not used in any workouts)
 */
export const remove = mutation({
  args: { id: v.id("exercises") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Get exercise
    const exercise = await ctx.db.get(args.id);
    if (!exercise) {
      throw new Error("Exercise not found");
    }

    // Verify ownership
    if (exercise.createdBy !== userId) {
      throw new Error("Not authorized to delete this exercise");
    }

    // Check if exercise is used in any workouts
    const usedInWorkouts = await ctx.db
      .query("workoutExercises")
      .withIndex("by_exercise", (q) => q.eq("exerciseId", args.id))
      .first();

    if (usedInWorkouts) {
      throw new Error(
        "Cannot delete exercise that is used in workouts. Remove it from all workouts first."
      );
    }

    // Check if exercise is used in any logs
    const usedInLogs = await ctx.db
      .query("setLogs")
      .withIndex("by_exercise", (q) => q.eq("exerciseId", args.id))
      .first();

    if (usedInLogs) {
      throw new Error(
        "Cannot delete exercise that has historical logs. This exercise is part of your workout history."
      );
    }

    // Delete exercise
    await ctx.db.delete(args.id);
  },
});
