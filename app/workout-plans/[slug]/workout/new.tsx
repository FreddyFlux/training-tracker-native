import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus, X, ArrowLeft, Link } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, View, Alert, TextInput, Modal, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as React from 'react';
import { useState } from 'react';
import type { Id } from '@/convex/_generated/dataModel';

interface ExerciseForm {
  exerciseId: string;
  sets: string;
  reps: string;
  weight: string;
  restTime: string;
  supersetWith?: string | null; // Index of exercise to superset with (as string for form state)
}

export default function NewWorkoutScreen() {
  const { user, isLoaded } = useUser();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  
  const plan = useQuery(api.workoutPlans.getWithWorkoutsBySlug, { slug: slug || '' });
  const exercises = useQuery(api.exercises.list);
  const createWorkout = useMutation(api.workouts.create);
  const createExercise = useMutation(api.exercises.create);
  
  const [workoutName, setWorkoutName] = useState('');
  const [workoutExercises, setWorkoutExercises] = useState<ExerciseForm[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [pickingForIndex, setPickingForIndex] = useState<number | null>(null);
  const [showCreateExercise, setShowCreateExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseMuscleGroup, setNewExerciseMuscleGroup] = useState('other');
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);

  function addExercise() {
    setWorkoutExercises([
      ...workoutExercises,
      {
        exerciseId: '',
        sets: '3',
        reps: '10',
        weight: '0',
        restTime: '60',
        supersetWith: null,
      },
    ]);
  }

  function removeExercise(index: number) {
    setWorkoutExercises(workoutExercises.filter((_, i) => i !== index));
  }

  function updateExercise(index: number, field: keyof ExerciseForm, value: string | null) {
    const updated = [...workoutExercises];
    updated[index] = { ...updated[index], [field]: value };
    setWorkoutExercises(updated);
  }

  async function handleCreateExercise() {
    if (!newExerciseName.trim()) {
      Alert.alert('Error', 'Please enter an exercise name');
      return;
    }

    setIsCreatingExercise(true);
    try {
      const exerciseId = await createExercise({
        name: newExerciseName.trim(),
        muscleGroup: newExerciseMuscleGroup,
      });
      
      // Select the newly created exercise
      if (pickingForIndex !== null) {
        updateExercise(pickingForIndex, 'exerciseId', exerciseId);
      }
      
      // Reset form
      setNewExerciseName('');
      setNewExerciseMuscleGroup('other');
      setShowCreateExercise(false);
      setShowExercisePicker(false);
      setPickingForIndex(null);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create exercise');
    } finally {
      setIsCreatingExercise(false);
    }
  }

  async function handleSubmit() {
    if (!plan) return;

    if (!workoutName.trim()) {
      Alert.alert('Error', 'Please enter a workout name');
      return;
    }

    const validExercises = workoutExercises.filter((ex) => ex.exerciseId);
    if (validExercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise');
      return;
    }

    setIsSubmitting(true);
    try {
      await createWorkout({
        planId: plan._id,
        name: workoutName.trim(),
        exercises: validExercises.map((ex, index) => {
          // Determine superset relationship
          let supersetWith: string | undefined = undefined;
          if (ex.supersetWith) {
            const targetIndex = parseInt(ex.supersetWith);
            if (!isNaN(targetIndex) && targetIndex >= 0 && targetIndex < validExercises.length) {
              // Use "previous" or "next" for easier handling in backend
              if (targetIndex === index - 1) {
                supersetWith = 'previous';
              } else if (targetIndex === index + 1) {
                supersetWith = 'next';
              } else {
                // For other indices, pass as string number
                supersetWith = targetIndex.toString();
              }
            }
          }
          
          return {
            exerciseId: ex.exerciseId as Id<'exercises'>,
            order: index,
            sets: parseInt(ex.sets) || 3,
            reps: parseInt(ex.reps) || 10,
            weight: parseFloat(ex.weight) || 0,
            restTime: parseInt(ex.restTime) || 60,
            supersetWith,
          };
        }),
      });
      
      router.push(`/workout-plans/${slug}`);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create workout');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isLoaded) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Please sign in to create a workout</Text>
      </View>
    );
  }

  if (plan === undefined || exercises === undefined) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-muted-foreground">Loading...</Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-center text-muted-foreground mb-4">
          Workout plan not found
        </Text>
        <Button onPress={() => router.back()}>
          <Icon as={ArrowLeft} className="size-5 mr-2" />
          <Text>Back</Text>
        </Button>
      </View>
    );
  }

  const canCreateWorkout = plan.workouts.length < plan.workoutsPerWeek;

  if (!canCreateWorkout) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-center text-muted-foreground mb-4">
          You've reached the maximum number of workouts for this plan ({plan.workoutsPerWeek} workouts per week).
        </Text>
        <Button onPress={() => router.back()}>
          <Icon as={ArrowLeft} className="size-5 mr-2" />
          <Text>Back</Text>
        </Button>
      </View>
    );
  }

  return (
      <ScrollView 
        className="flex-1 bg-zinc-50 dark:bg-black" 
        contentContainerClassName="p-4 gap-4"
      >
        {/* Workout Details */}
        <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-black dark:text-zinc-50">Workout Details</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            <View className="gap-2">
              <Text className="text-sm font-medium text-black dark:text-zinc-50">Workout Name</Text>
              <Input
                placeholder="e.g. Upper Body Push"
                value={workoutName}
                onChangeText={setWorkoutName}
              />
            </View>
          </CardContent>
        </Card>

        {/* Exercises */}
        <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader>
            <View className="flex-row items-center justify-between">
              <CardTitle className="text-black dark:text-zinc-50">Exercises</CardTitle>
              <Button variant="outline" size="sm" onPress={addExercise}>
                <Icon as={Plus} className="size-4 mr-2" />
                <Text>Add</Text>
              </Button>
            </View>
          </CardHeader>
          <CardContent className="gap-4">
            {workoutExercises.length === 0 ? (
              <View className="items-center py-8">
                <Text className="text-muted-foreground mb-4">
                  No exercises added yet. Click "Add Exercise" to get started.
                </Text>
                <Button variant="outline" onPress={addExercise}>
                  <Icon as={Plus} className="size-4 mr-2" />
                  <Text>Add Exercise</Text>
                </Button>
              </View>
            ) : (
              <View className="gap-4">
                {workoutExercises.map((exercise, index) => (
                  <React.Fragment key={index}>
                    <Card
                      className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <CardHeader>
                        <View className="flex-row items-center justify-between">
                          <CardTitle className="text-black dark:text-zinc-50">
                            Exercise {index + 1}
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onPress={() => removeExercise(index)}
                          >
                            <Icon as={X} className="size-4" />
                          </Button>
                        </View>
                      </CardHeader>
                      <CardContent className="gap-3">
                        <View className="gap-2">
                          <Text className="text-sm font-medium text-black dark:text-zinc-50">
                            Exercise
                          </Text>
                          <Button
                            variant="outline"
                            onPress={() => {
                              setPickingForIndex(index);
                              setShowExercisePicker(true);
                            }}
                          >
                            <Text>
                              {exercise.exerciseId
                                ? exercises?.find((e) => e._id === exercise.exerciseId)?.name ||
                                  'Select exercise...'
                                : 'Select exercise...'}
                            </Text>
                          </Button>
                        </View>
                        <View className="flex-row gap-2">
                          <View className="flex-1 gap-2">
                            <Text className="text-sm font-medium text-black dark:text-zinc-50">
                              Sets
                            </Text>
                            <Input
                              keyboardType="numeric"
                              value={exercise.sets}
                              onChangeText={(text) => updateExercise(index, 'sets', text)}
                            />
                          </View>
                          <View className="flex-1 gap-2">
                            <Text className="text-sm font-medium text-black dark:text-zinc-50">
                              Reps
                            </Text>
                            <Input
                              keyboardType="numeric"
                              value={exercise.reps}
                              onChangeText={(text) => updateExercise(index, 'reps', text)}
                            />
                          </View>
                        </View>
                        <View className="flex-row gap-2">
                          <View className="flex-1 gap-2">
                            <Text className="text-sm font-medium text-black dark:text-zinc-50">
                              Weight (kg)
                            </Text>
                            <Input
                              keyboardType="numeric"
                              value={exercise.weight}
                              onChangeText={(text) => updateExercise(index, 'weight', text)}
                            />
                          </View>
                          <View className="flex-1 gap-2">
                            <Text className="text-sm font-medium text-black dark:text-zinc-50">
                              Rest (sec)
                            </Text>
                            <Input
                              keyboardType="numeric"
                              value={exercise.restTime}
                              onChangeText={(text) => updateExercise(index, 'restTime', text)}
                            />
                          </View>
                        </View>
                        <View className="gap-2">
                          <Text className="text-sm font-medium text-black dark:text-zinc-50">
                            Options
                          </Text>
                          <View className="flex-row gap-2">
                            <Button
                              variant={exercise.supersetWith ? 'default' : 'outline'}
                              className="flex-1"
                              onPress={() => {
                                if (exercise.supersetWith) {
                                  updateExercise(index, 'supersetWith', null);
                                } else {
                                  // Toggle superset - connect to next exercise if available
                                  if (index < workoutExercises.length - 1) {
                                    updateExercise(index, 'supersetWith', (index + 1).toString());
                                  } else if (index > 0) {
                                    updateExercise(index, 'supersetWith', (index - 1).toString());
                                  }
                                }
                              }}
                            >
                              <Icon as={Link} className="size-4 mr-2" />
                              <Text>
                                {exercise.supersetWith
                                  ? `Superset with Exercise ${parseInt(exercise.supersetWith) + 1}`
                                  : 'Add Superset'}
                              </Text>
                            </Button>
                          </View>
                          {exercise.supersetWith && (
                            <View className="mt-2">
                              <Text className="text-xs text-muted-foreground">
                                Connected to Exercise {parseInt(exercise.supersetWith) + 1}
                              </Text>
                            </View>
                          )}
                        </View>
                      </CardContent>
                    </Card>
                    {/* Link icon below if superset with next */}
                    {exercise.supersetWith && parseInt(exercise.supersetWith) === index + 1 && (
                      <View className="items-center mt-2">
                        <Icon as={Link} className="size-4 text-zinc-500 dark:text-zinc-400" />
                      </View>
                    )}
                  </React.Fragment>
                ))}
                <Button variant="outline" onPress={addExercise}>
                  <Icon as={Plus} className="size-4 mr-2" />
                  <Text>Add Exercise</Text>
                </Button>
              </View>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <View className="flex-row gap-2">
          <Button
            variant="outline"
            onPress={() => router.back()}
            className="flex-1"
          >
            <Text>Cancel</Text>
          </Button>
          <Button onPress={handleSubmit} disabled={isSubmitting} className="flex-1">
            <Text>{isSubmitting ? 'Creating...' : 'Create Workout'}</Text>
          </Button>
        </View>

        {/* Exercise Picker Modal */}
        <Modal
          visible={showExercisePicker}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowExercisePicker(false);
            setShowCreateExercise(false);
            setPickingForIndex(null);
          }}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white dark:bg-zinc-900 rounded-t-lg max-h-[80%]">
              <View className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                <View className="flex-row items-center justify-between">
                  <Text className="text-lg font-semibold text-black dark:text-zinc-50">
                    {showCreateExercise ? 'Create New Exercise' : 'Select Exercise'}
                  </Text>
                  <Button
                    variant="ghost"
                    onPress={() => {
                      setShowExercisePicker(false);
                      setShowCreateExercise(false);
                      setPickingForIndex(null);
                    }}
                  >
                    <Icon as={X} className="size-5" />
                  </Button>
                </View>
              </View>
              
              {showCreateExercise ? (
                <ScrollView className="p-4">
                  <View className="gap-4">
                    <View className="gap-2">
                      <Text className="text-sm font-medium text-black dark:text-zinc-50">
                        Exercise Name
                      </Text>
                      <Input
                        placeholder="e.g. Bench Press"
                        value={newExerciseName}
                        onChangeText={setNewExerciseName}
                        autoFocus
                      />
                    </View>
                    <View className="gap-2">
                      <Text className="text-sm font-medium text-black dark:text-zinc-50">
                        Muscle Group
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'other'].map((group) => (
                          <Button
                            key={group}
                            variant={newExerciseMuscleGroup === group ? 'default' : 'outline'}
                            size="sm"
                            onPress={() => setNewExerciseMuscleGroup(group)}
                          >
                            <Text className="capitalize">{group}</Text>
                          </Button>
                        ))}
                      </View>
                    </View>
                    <View className="flex-row gap-2 mt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onPress={() => {
                          setShowCreateExercise(false);
                          setNewExerciseName('');
                          setNewExerciseMuscleGroup('other');
                        }}
                      >
                        <Text>Cancel</Text>
                      </Button>
                      <Button
                        className="flex-1"
                        onPress={handleCreateExercise}
                        disabled={isCreatingExercise || !newExerciseName.trim()}
                      >
                        <Text>{isCreatingExercise ? 'Creating...' : 'Create'}</Text>
                      </Button>
                    </View>
                  </View>
                </ScrollView>
              ) : (
                <>
                  <View className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                    <Button
                      variant="outline"
                      onPress={() => setShowCreateExercise(true)}
                    >
                      <Icon as={Plus} className="size-4 mr-2" />
                      <Text>Create New Exercise</Text>
                    </Button>
                  </View>
                  <FlatList
                    data={exercises || []}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                      <Pressable
                        onPress={() => {
                          if (pickingForIndex !== null) {
                            updateExercise(pickingForIndex, 'exerciseId', item._id);
                          }
                          setShowExercisePicker(false);
                          setPickingForIndex(null);
                        }}
                        className="p-4 border-b border-zinc-200 dark:border-zinc-800"
                      >
                        <Text className="text-black dark:text-zinc-50">{item.name}</Text>
                        {item.muscleGroup && (
                          <Text className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            {item.muscleGroup}
                          </Text>
                        )}
                      </Pressable>
                    )}
                  />
                </>
              )}
            </View>
          </View>
        </Modal>
      </ScrollView>
  );
}

