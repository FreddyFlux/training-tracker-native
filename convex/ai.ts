import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getUserId } from "./auth";
import type { Doc } from "./_generated/dataModel";
import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";

// Use GPT-3.5 Turbo for MVP
const MODEL = "gpt-3.5-turbo";

// Lazy initialization of OpenAI client to avoid errors during deployment analysis
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing credentials. Please set the `OPENAI_API_KEY` environment variable.");
  }
  return new OpenAI({ apiKey });
}

/**
 * Helper: Generate exercise details for a missing exercise
 */
async function generateExerciseDetails(
  exerciseName: string,
  existingExercises: Doc<"exercises">[]
): Promise<{
  name: string;
  muscleGroup: string;
  equipment?: string;
  description?: string;
}> {
  const systemPrompt = `You are an expert fitness trainer. Generate exercise details for exercises that don't exist in the database.

Available muscle groups: chest, back, shoulders, arms, legs, core, cardio, other
Available equipment types: machine, dumbbell, barbell, bodyweight, other

Return ONLY valid JSON with this structure:
{
  "name": "string (exercise name, exactly as provided)",
  "muscleGroup": "string (one of: chest, back, shoulders, arms, legs, core, cardio, other)",
  "equipment": "string (optional, one of: machine, dumbbell, barbell, bodyweight, other)",
  "description": "string (optional, brief description of the exercise)"
}

Return ONLY valid JSON, no markdown formatting, no code blocks.`;

  const userPrompt = `Generate exercise details for: "${exerciseName}"

Consider similar exercises in the database for context:
${JSON.stringify(
  existingExercises.slice(0, 10).map((e) => ({
    name: e.name,
    muscleGroup: e.muscleGroup,
    equipment: e.equipment || "none",
  })),
  null,
  2
)}`;

  const completion: ChatCompletion = await getOpenAIClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.5, // Lower temperature for more consistent exercise details
    max_tokens: 300,
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error(`Failed to generate details for exercise: ${exerciseName}`);
  }

  try {
    const exerciseData = JSON.parse(content);
    
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
    if (!validMuscleGroups.includes(exerciseData.muscleGroup)) {
      exerciseData.muscleGroup = "other";
    }

    // Validate equipment if provided
    if (exerciseData.equipment) {
      const validEquipment = ["machine", "dumbbell", "barbell", "bodyweight", "other"];
      if (!validEquipment.includes(exerciseData.equipment)) {
        exerciseData.equipment = undefined;
      }
    }

    return {
      name: exerciseData.name || exerciseName,
      muscleGroup: exerciseData.muscleGroup,
      equipment: exerciseData.equipment,
      description: exerciseData.description,
    };
  } catch (parseError) {
    throw new Error(`Invalid JSON response for exercise: ${exerciseName}`);
  }
}

/**
 * Generate a workout plan from a natural language prompt
 */
export const generateWorkoutPlan = action({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    // Authenticate user
    const userId = await getUserId(ctx);

    // Validate prompt
    if (!args.prompt || args.prompt.trim().length === 0) {
      throw new Error("Prompt cannot be empty");
    }

    if (args.prompt.length > 2000) {
      throw new Error("Prompt must be less than 2000 characters");
    }

    try {
      // Step 1: Gather context - get available exercises
      const exercises: Doc<"exercises">[] = await ctx.runQuery(api.exercises.list);

      // Step 2: Build the system prompt - allow AI to suggest exercises that don't exist
      const systemPrompt: string = `You are an expert fitness trainer with deep knowledge of exercise science, 
programming, and periodization. Your task is to generate the BEST workout plan possible based on user requests.

Guidelines:
- Generate the optimal workout plan for the user's goals, even if some exercises don't exist in the database
- Prefer using exercises from the provided database when they fit well
- If the best exercise for a goal doesn't exist, suggest it anyway - it will be created automatically
- Follow evidence-based training principles
- Include appropriate sets, reps, rest times, and progression
- Consider the user's experience level and goals mentioned in their request
- Ensure proper exercise selection and order
- Return valid JSON matching the exact schema provided

Available Exercises (use these when appropriate, but don't limit yourself):
${JSON.stringify(
  exercises.map((e: Doc<"exercises">) => ({
    name: e.name,
    muscleGroup: e.muscleGroup,
    equipment: e.equipment || "none",
    description: e.description || "",
  })),
  null,
  2
)}

Return ONLY valid JSON, no markdown formatting, no code blocks.`;

      // Step 3: Build the user prompt with schema
      const userPrompt = `${args.prompt}

Return a JSON object with this exact structure:
{
  "name": "string (workout plan name, 3-100 characters)",
  "description": "string (brief description, optional)",
  "workoutsPerWeek": number (1-7, number of workouts per week),
  "workouts": [
    {
      "name": "string (workout name, e.g., 'Upper Body Day 1')",
      "exercises": [
        {
          "exerciseName": "string (exercise name - can be from database or a new exercise)",
          "sets": number (must be 1-10, typically 3-5),
          "reps": number (MUST be 1-50, typically 5-20 for strength exercises, 10-30 for hypertrophy, 15-50 for endurance. For time-based exercises like Plank, use 1-50 to represent duration in seconds or number of holds),
          "weight": number (0 if user should set their own weight, otherwise suggested weight in kg, must be >= 0),
          "restTime": number (rest time in seconds, must be >= 0, typically 60-300)
        }
      ]
    }
  ]
}

CRITICAL: All reps values MUST be between 1 and 50. Never use 0 or negative numbers for reps. For time-based exercises (like Plank, Wall Sit, etc.), use reps to represent either the number of holds/sets OR the duration in seconds (within 1-50 range).`;

      // Step 4: Call OpenAI
      const completion: ChatCompletion = await getOpenAIClient().chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7, // Balance creativity and consistency
        max_tokens: 2000,
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      // Step 5: Parse and validate the response
      let planData;
      try {
        planData = JSON.parse(content);
      } catch (parseError) {
        throw new Error("Invalid JSON response from AI");
      }

      // Validate structure
      if (!planData.name || !planData.workouts || !Array.isArray(planData.workouts)) {
        throw new Error("Invalid plan structure: missing name or workouts array");
      }

      // Validate plan name length
      if (planData.name.length < 3 || planData.name.length > 100) {
        throw new Error("Plan name must be between 3 and 100 characters");
      }

      // Validate workouts per week
      if (
        typeof planData.workoutsPerWeek !== "number" ||
        planData.workoutsPerWeek < 1 ||
        planData.workoutsPerWeek > 7
      ) {
        throw new Error("Workouts per week must be between 1 and 7");
      }

      // Step 6: Normalize and validate exercise data
      const exerciseNames = exercises.map((e: Doc<"exercises">) => e.name);
      const missingExercises = new Set<string>();

      // List of time-based exercises that might have reps representing duration
      const timeBasedExercises = [
        "plank",
        "wall sit",
        "dead hang",
        "hollow hold",
        "l-sit",
        "side plank",
        "forearm plank",
        "high plank",
      ];

      // First pass: normalize and validate structure, identify missing exercises
      for (const workout of planData.workouts) {
        if (!workout.name || !Array.isArray(workout.exercises)) {
          throw new Error("Invalid workout structure: missing name or exercises array");
        }

        for (const exercise of workout.exercises) {
          if (!exercise.exerciseName) {
            throw new Error("Exercise missing name");
          }

          // Normalize reps: fix invalid values before validation
          if (typeof exercise.reps !== "number" || isNaN(exercise.reps)) {
            // If reps is not a valid number, set a default based on exercise type
            const exerciseNameLower = exercise.exerciseName.toLowerCase();
            const isTimeBased = timeBasedExercises.some((name) =>
              exerciseNameLower.includes(name)
            );
            exercise.reps = isTimeBased ? 30 : 12; // 30 seconds for time-based, 12 reps for regular
          } else if (exercise.reps < 1) {
            // If reps is 0 or negative, fix it
            const exerciseNameLower = exercise.exerciseName.toLowerCase();
            const isTimeBased = timeBasedExercises.some((name) =>
              exerciseNameLower.includes(name)
            );
            exercise.reps = isTimeBased ? 30 : 12; // 30 seconds for time-based, 12 reps for regular
          } else if (exercise.reps > 50) {
            // Cap reps at 50
            exercise.reps = 50;
          }

          // Normalize sets
          if (typeof exercise.sets !== "number" || isNaN(exercise.sets) || exercise.sets < 1) {
            exercise.sets = 3; // Default to 3 sets
          } else if (exercise.sets > 10) {
            exercise.sets = 10; // Cap at 10 sets
          }

          // Normalize weight
          if (typeof exercise.weight !== "number" || isNaN(exercise.weight) || exercise.weight < 0) {
            exercise.weight = 0; // Default to 0 (user sets weight)
          }

          // Normalize restTime
          if (typeof exercise.restTime !== "number" || isNaN(exercise.restTime) || exercise.restTime < 0) {
            exercise.restTime = 60; // Default to 60 seconds
          }

          // Check if exercise exists (case-insensitive check)
          const exerciseExists = exerciseNames.some(
            (name) => name.toLowerCase() === exercise.exerciseName.toLowerCase()
          );

          if (!exerciseExists) {
            missingExercises.add(exercise.exerciseName);
          }

          // Final validation after normalization
          if (exercise.sets < 1 || exercise.sets > 10) {
            throw new Error(`Invalid sets for ${exercise.exerciseName}: must be 1-10`);
          }

          if (exercise.reps < 1 || exercise.reps > 50) {
            throw new Error(`Invalid reps for ${exercise.exerciseName}: must be 1-50`);
          }

          if (exercise.restTime < 0) {
            throw new Error(
              `Invalid rest time for ${exercise.exerciseName}: must be >= 0`
            );
          }
        }
      }

      // Step 7: Create missing exercises
      const createdExercises: string[] = [];
      const exerciseNameMap = new Map<string, string>(); // Maps requested name to actual created name
      
      // Refresh exercises list before creating to ensure we have the latest
      let allExercisesNow = await ctx.runQuery(api.exercises.list);
      
      for (const exerciseName of missingExercises) {
        try {
          // Generate exercise details using AI
          const exerciseDetails = await generateExerciseDetails(
            exerciseName,
            allExercisesNow
          );

          // Check if exercise already exists (case-insensitive)
          const existingExercise = allExercisesNow.find(
            (e) => e.name.toLowerCase() === exerciseDetails.name.toLowerCase()
          );

          if (!existingExercise) {
            try {
              // Create the exercise
              await ctx.runMutation(api.exercises.create, {
                name: exerciseDetails.name,
                description: exerciseDetails.description,
                muscleGroup: exerciseDetails.muscleGroup,
                equipment: exerciseDetails.equipment,
              });

              // Refresh exercises list after creation
              allExercisesNow = await ctx.runQuery(api.exercises.list);
              
              // Find the newly created exercise
              const newlyCreated = allExercisesNow.find(
                (e) => e.name.toLowerCase() === exerciseDetails.name.toLowerCase()
              );

              if (newlyCreated) {
                createdExercises.push(newlyCreated.name);
                // Map the requested name to the created name (in case they differ)
                exerciseNameMap.set(exerciseName.toLowerCase(), newlyCreated.name);
                exerciseNames.push(newlyCreated.name);
              } else {
                // Fallback: use the name we tried to create
                createdExercises.push(exerciseDetails.name);
                exerciseNameMap.set(exerciseName.toLowerCase(), exerciseDetails.name);
                exerciseNames.push(exerciseDetails.name);
              }
            } catch (createError: unknown) {
              // If creation fails (e.g., duplicate name), try to find existing exercise
              const duplicateCheck = await ctx.runQuery(api.exercises.list);
              const found = duplicateCheck.find(
                (e) => e.name.toLowerCase() === exerciseDetails.name.toLowerCase()
              );
              
              if (found) {
                // Exercise exists now (maybe created by another request), use it
                exerciseNameMap.set(exerciseName.toLowerCase(), found.name);
                if (!exerciseNames.includes(found.name)) {
                  exerciseNames.push(found.name);
                }
                allExercisesNow = duplicateCheck;
              } else {
                // Re-throw if we can't find it and creation failed
                console.error(`Failed to create exercise ${exerciseName}:`, createError);
                throw createError;
              }
            }
          } else {
            // Exercise already exists, map the requested name to the existing name
            exerciseNameMap.set(exerciseName.toLowerCase(), existingExercise.name);
            if (!exerciseNames.includes(existingExercise.name)) {
              exerciseNames.push(existingExercise.name);
            }
          }
        } catch (error) {
          console.error(`Failed to create exercise ${exerciseName}:`, error);
          throw new Error(
            `Failed to create exercise "${exerciseName}": ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      // Step 8: Normalize exercise names (handle case-insensitive matching and name mapping)
      // Final refresh of exercises to ensure we have the latest state
      const finalExercisesList = await ctx.runQuery(api.exercises.list);
      const finalExerciseNames = finalExercisesList.map((e) => e.name);
      
      for (const workout of planData.workouts) {
        for (const exercise of workout.exercises) {
          // First check if we have a mapping from creation
          const mappedName = exerciseNameMap.get(exercise.exerciseName.toLowerCase());
          if (mappedName) {
            exercise.exerciseName = mappedName;
          } else {
            // Find the exact exercise name from database (case-insensitive match)
            const exactName = finalExerciseNames.find(
              (name) => name.toLowerCase() === exercise.exerciseName.toLowerCase()
            );
            if (exactName) {
              exercise.exerciseName = exactName;
            } else {
              // This should not happen, but log it for debugging
              console.warn(
                `Exercise "${exercise.exerciseName}" not found after creation attempt. Available exercises: ${finalExerciseNames.slice(0, 5).join(", ")}...`
              );
            }
          }
        }
      }

      // Final validation: ensure all exercises exist
      const missingAfterCreation: string[] = [];
      for (const workout of planData.workouts) {
        for (const exercise of workout.exercises) {
          const exists = finalExerciseNames.some(
            (name) => name.toLowerCase() === exercise.exerciseName.toLowerCase()
          );
          if (!exists) {
            missingAfterCreation.push(exercise.exerciseName);
          }
        }
      }

      if (missingAfterCreation.length > 0) {
        console.error(
          `Exercises still missing after creation attempt: ${missingAfterCreation.join(", ")}`
        );
        throw new Error(
          `Failed to create exercises: ${missingAfterCreation.join(", ")}. Please try again.`
        );
      }

      return {
        success: true,
        plan: planData,
        createdExercises: createdExercises.length > 0 ? createdExercises : undefined,
        usage: completion.usage,
      };
    } catch (error) {
      console.error("AI generation error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
});

/**
 * Chat with AI trainer
 */
export const chatWithTrainer = action({
  args: {
    message: v.string(),
    conversationHistory: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    // Authenticate user
    const userId = await getUserId(ctx);

    // Validate message
    if (!args.message || args.message.trim().length === 0) {
      throw new Error("Message cannot be empty");
    }

    if (args.message.length > 2000) {
      throw new Error("Message must be less than 2000 characters");
    }

    try {
      // Gather user context
      const [recentWorkouts, exercises]: [Doc<"workoutLogs">[], Doc<"exercises">[]] = await Promise.all([
        ctx.runQuery(api.workoutLogs.list, { limit: 10 }),
        ctx.runQuery(api.exercises.list),
      ]);

      // Build context about user's progress
      const progressionContext = buildProgressionContext(recentWorkouts);

      const systemPrompt: string = `You are a knowledgeable and supportive personal trainer. 
You help users with:
- Exercise form and technique advice
- Workout programming questions
- Nutrition and recovery tips (general guidance only)
- Motivation and encouragement
- Analyzing their workout progression

User's Recent Activity:
${JSON.stringify(progressionContext, null, 2)}

Available Exercises:
${exercises.map((e: Doc<"exercises">) => e.name).join(", ")}

Guidelines:
- Be concise, helpful, and encouraging
- If asked about exercises, reference the available exercise database
- Provide evidence-based advice
- If you don't know something, say so rather than guessing
- Keep responses under 300 words unless specifically asked for more detail
- For medical or injury-related questions, always recommend consulting a healthcare professional`;

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system" as const, content: systemPrompt },
        ...(args.conversationHistory || []),
        { role: "user" as const, content: args.message },
      ];

      const completion: ChatCompletion = await getOpenAIClient().chat.completions.create({
        model: MODEL,
        messages: messages,
        temperature: 0.8, // More conversational
        max_tokens: 500,
      });

      const response: string | null = completion.choices[0].message.content;

      if (!response) {
        throw new Error("No response from AI");
      }

      return {
        success: true,
        response,
        usage: completion.usage,
      };
    } catch (error) {
      console.error("AI chat error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
});

/**
 * Helper: Analyze user's workout progression
 */
function buildProgressionContext(workoutLogs: Doc<"workoutLogs">[]) {
  if (workoutLogs.length === 0) {
    return {
      message: "No workout history yet. Start tracking workouts to get personalized advice!",
      totalWorkouts: 0,
      recentActivity: [],
    };
  }

  const completedWorkouts = workoutLogs.filter(
    (log) => log.status === "completed"
  );

  if (completedWorkouts.length === 0) {
    return {
      message: "You have started workouts but haven't completed any yet.",
      totalWorkouts: 0,
      recentActivity: [],
    };
  }

  // Get recent completed workouts
  const recentActivity = completedWorkouts
    .slice(0, 5)
    .map((log) => ({
      name: log.name,
      date: new Date(log.completedAt || log.startedAt).toLocaleDateString(),
      status: log.status,
    }));

  // Calculate consistency (workouts per week estimate)
  const oldestWorkout = completedWorkouts[completedWorkouts.length - 1];
  const newestWorkout = completedWorkouts[0];
  const daysDiff =
    (newestWorkout.completedAt || newestWorkout.startedAt) -
    (oldestWorkout.completedAt || oldestWorkout.startedAt);
  const weeksDiff = Math.max(1, Math.floor(daysDiff / (1000 * 60 * 60 * 24 * 7)));
  const workoutsPerWeek = completedWorkouts.length / weeksDiff;

  return {
    totalWorkouts: completedWorkouts.length,
    recentActivity,
    consistency:
      workoutsPerWeek >= 3
        ? "excellent"
        : workoutsPerWeek >= 2
        ? "good"
        : workoutsPerWeek >= 1
        ? "moderate"
        : "needs improvement",
    workoutsPerWeek: workoutsPerWeek.toFixed(1),
    message: `You've completed ${completedWorkouts.length} workout${
      completedWorkouts.length !== 1 ? "s" : ""
    } recently. ${workoutsPerWeek >= 3 ? "Great consistency!" : "Keep it up!"}`,
  };
}

