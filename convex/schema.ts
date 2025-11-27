import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // User's workout plans
  workoutPlans: defineTable({
    userId: v.string(),
    name: v.string(),
    slug: v.string(), // URL-friendly version of name
    description: v.optional(v.string()),
    workoutsPerWeek: v.number(), // Number of workouts per week (1-10)
    isActive: v.boolean(), // Only one active plan per user
    isShared: v.optional(v.boolean()), // Whether this plan is shared publicly (optional for backward compatibility)
    sharedByName: v.optional(v.string()), // Creator's name for display
    likeCount: v.optional(v.number()), // Number of likes (defaults to 0)
    copyCount: v.optional(v.number()), // Number of times this plan has been copied (defaults to 0)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_and_active', ['userId', 'isActive'])
    .index('by_user_and_slug', ['userId', 'slug'])
    .index('by_shared', ['isShared'])
    .index('by_shared_name', ['isShared', 'name'])
    .index('by_shared_and_slug', ['isShared', 'slug']),

  // Workouts within a plan (templates)
  workouts: defineTable({
    planId: v.optional(v.id('workoutPlans')), // Optional for standalone templates
    userId: v.string(), // Denormalized for quick filtering
    name: v.string(),
    workoutNumber: v.number(), // Sequential number within the plan for URL routing
    order: v.number(), // Display order
    isTemplate: v.boolean(), // If true, this is a saved template
    completionCount: v.optional(v.number()), // Number of times this workout has been completed
    sharedWorkoutId: v.optional(v.id('sharedWorkouts')), // Reference to shared workout if this is based on one
    createdAt: v.number(),
  })
    .index('by_plan', ['planId'])
    .index('by_user', ['userId'])
    .index('by_user_and_template', ['userId', 'isTemplate'])
    .index('by_plan_and_workout_number', ['planId', 'workoutNumber'])
    .index('by_shared_workout', ['sharedWorkoutId']),

  // Global exercise library
  exercises: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    muscleGroup: v.string(), // "chest", "back", "shoulders", "arms", "legs", "core", "cardio", "other"
    equipment: v.optional(v.string()),
    createdBy: v.string(), // userId who created it
    isVerified: v.boolean(), // Admin verification (future feature)
    createdAt: v.number(),
  })
    .index('by_name', ['name'])
    .index('by_muscle_group', ['muscleGroup'])
    .index('by_created_by', ['createdBy'])
    .searchIndex('search_name', {
      searchField: 'name',
      filterFields: ['muscleGroup'],
    }),

  // Links exercises to workouts with parameters
  workoutExercises: defineTable({
    workoutId: v.id('workouts'),
    exerciseId: v.id('exercises'),
    order: v.number(), // Sequence in workout
    sets: v.number(),
    reps: v.number(),
    weight: v.number(), // Prescribed weight in kg
    restTime: v.number(), // Rest time in seconds
    supersetWith: v.optional(v.union(v.id('workoutExercises'), v.null())), // ID of the exercise this is superset with (null if not in superset)
  })
    .index('by_workout', ['workoutId'])
    .index('by_exercise', ['exerciseId']),

  // Records of actual workout sessions
  workoutLogs: defineTable({
    userId: v.string(),
    workoutId: v.optional(v.id('workouts')), // Template (null for custom workouts)
    planId: v.optional(v.id('workoutPlans')),
    sharedWorkoutId: v.optional(v.id('sharedWorkouts')), // Reference to shared workout if this is based on one
    name: v.string(), // Copied from template or custom
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    status: v.string(), // "in_progress" | "completed" | "abandoned"
    notes: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_user_and_status', ['userId', 'status'])
    .index('by_user_and_started', ['userId', 'startedAt'])
    .index('by_user_and_plan', ['userId', 'planId'])
    .index('by_user_and_plan_and_status', ['userId', 'planId', 'status'])
    .index('by_shared_workout', ['sharedWorkoutId']),

  // Individual sets logged during workout
  setLogs: defineTable({
    workoutLogId: v.id('workoutLogs'),
    exerciseId: v.id('exercises'),
    setNumber: v.number(),
    weight: v.number(),
    reps: v.number(),
    completedAt: v.number(),
    skipped: v.boolean(),
  })
    .index('by_workout_log', ['workoutLogId'])
    .index('by_exercise', ['exerciseId']),

  // Tracks which users have liked which shared workout plans
  planLikes: defineTable({
    planId: v.id('workoutPlans'),
    userId: v.string(),
    createdAt: v.number(),
  })
    .index('by_plan', ['planId'])
    .index('by_user', ['userId'])
    .index('by_plan_and_user', ['planId', 'userId']),

  // Shared workouts that can be reused by other users
  sharedWorkouts: defineTable({
    userId: v.string(), // User who shared it
    sharedByName: v.string(), // Name of user who shared it
    name: v.string(),
    likeCount: v.number(), // Number of likes (defaults to 0)
    usageCounter: v.number(), // Number of times this workout has been used (defaults to 0)
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_name', ['name'])
    .searchIndex('search_name', {
      searchField: 'name',
    }),

  // Links exercises to shared workouts with parameters
  sharedWorkoutExercises: defineTable({
    sharedWorkoutId: v.id('sharedWorkouts'),
    exerciseId: v.id('exercises'),
    order: v.number(), // Sequence in workout
    sets: v.number(),
    reps: v.number(),
    weight: v.number(), // Prescribed weight in kg
    restTime: v.number(), // Rest time in seconds
    supersetWith: v.optional(v.union(v.id('sharedWorkoutExercises'), v.null())), // ID of the exercise this is superset with (null if not in superset)
  })
    .index('by_shared_workout', ['sharedWorkoutId'])
    .index('by_exercise', ['exerciseId']),

  // Tracks which users have liked which shared workouts
  sharedWorkoutLikes: defineTable({
    sharedWorkoutId: v.id('sharedWorkouts'),
    userId: v.string(),
    createdAt: v.number(),
  })
    .index('by_shared_workout', ['sharedWorkoutId'])
    .index('by_user', ['userId'])
    .index('by_shared_workout_and_user', ['sharedWorkoutId', 'userId']),
});
