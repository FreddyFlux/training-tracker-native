import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus, X, ArrowLeft, GripVertical, Link } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, View, Alert, Modal, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as React from 'react';
import { useState, useEffect } from 'react';
import type { Id } from '@/convex/_generated/dataModel';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';

interface ExerciseForm {
  id?: string;
  exerciseId: string;
  sets: string;
  reps: string;
  weight: string;
  restTime: string;
  supersetWith?: string | null; // ID of the exercise this is superset with
}

export default function EditWorkoutScreen() {
  const { user, isLoaded } = useUser();
  const { slug, number } = useLocalSearchParams<{ slug: string; number: string }>();
  const insets = useSafeAreaInsets();
  const workoutNumber = parseInt(number || '1');
  
  const plan = useQuery(api.workoutPlans.getBySlug, { slug: slug || '' });
  const workout = useQuery(api.workouts.getByPlanSlugAndNumber, {
    planSlug: slug || '',
    workoutNumber,
  });
  const exercises = useQuery(api.exercises.list);
  
  const updateWorkout = useMutation(api.workouts.update);
  const addExercise = useMutation(api.workouts.addExercise);
  const updateExercise = useMutation(api.workouts.updateExercise);
  const removeExercise = useMutation(api.workouts.removeExercise);
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

  // Load workout data
  useEffect(() => {
    if (workout) {
      setWorkoutName(workout.name);
      setWorkoutExercises(
        workout.exercises?.map((ex) => ({
          id: ex._id,
          exerciseId: ex.exerciseId,
          sets: ex.sets.toString(),
          reps: ex.reps.toString(),
          weight: ex.weight.toString(),
          restTime: ex.restTime.toString(),
          supersetWith: ex.supersetWith || null,
        })) || []
      );
    }
  }, [workout]);

  function addExerciseForm() {
    setWorkoutExercises([
      ...workoutExercises,
      {
        id: `temp-${Date.now()}-${Math.random()}`,
        exerciseId: '',
        sets: '3',
        reps: '10',
        weight: '0',
        restTime: '60',
        supersetWith: null,
      },
    ]);
  }

  function removeExerciseForm(index: number) {
    setWorkoutExercises(workoutExercises.filter((_, i) => i !== index));
  }

  function updateExerciseForm(index: number, field: keyof ExerciseForm, value: string | null) {
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
        updateExerciseForm(pickingForIndex, 'exerciseId', exerciseId);
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

  function handleDragEnd({ data }: { data: ExerciseForm[] }) {
    setWorkoutExercises(data);
  }

  async function handleSubmit() {
    if (!workout || !plan) return;

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
      // Update workout name
      await updateWorkout({
        id: workout._id,
        name: workoutName.trim(),
      });

      // Get existing exercise IDs
      const existingExerciseIds = new Set<string>(
        workout.exercises?.map((ex) => ex._id) || []
      );
      const formExerciseIds = new Set<string>(
        validExercises.filter((ex) => ex.id).map((ex) => ex.id!)
      );

      // Remove exercises that are no longer in the form
      for (const existingId of existingExerciseIds) {
        if (!formExerciseIds.has(existingId)) {
          await removeExercise({ id: existingId as Id<'workoutExercises'> });
        }
      }

      // First pass: Update or add exercises (without superset relationships)
      const exerciseIdMap = new Map<string, Id<'workoutExercises'>>(); // formId -> workoutExerciseId
      
      for (let i = 0; i < validExercises.length; i++) {
        const ex = validExercises[i];
        
        if (ex.id && existingExerciseIds.has(ex.id)) {
          // Update existing exercise (without superset for now)
          await updateExercise({
            id: ex.id as Id<'workoutExercises'>,
            order: i,
            sets: parseInt(ex.sets) || 3,
            reps: parseInt(ex.reps) || 10,
            weight: parseFloat(ex.weight) || 0,
            restTime: parseInt(ex.restTime) || 60,
            supersetWith: null, // Will be set in second pass
          });
          exerciseIdMap.set(ex.id, ex.id as Id<'workoutExercises'>);
        } else {
          // Add new exercise
          const newId = await addExercise({
            workoutId: workout._id,
            exerciseId: ex.exerciseId as Id<'exercises'>,
            order: i,
            sets: parseInt(ex.sets) || 3,
            reps: parseInt(ex.reps) || 10,
            weight: parseFloat(ex.weight) || 0,
            restTime: parseInt(ex.restTime) || 60,
          });
          if (ex.id) {
            exerciseIdMap.set(ex.id, newId);
          }
        }
      }

      // Second pass: Update superset relationships
      for (let i = 0; i < validExercises.length; i++) {
        const ex = validExercises[i];
        if (ex.id && ex.supersetWith) {
          // Find the target exercise ID
          const targetEx = validExercises.find((e, idx) => {
            if (ex.supersetWith === e.id) return true;
            // Also check if it's an index reference
            const targetIdx = parseInt(ex.supersetWith);
            return !isNaN(targetIdx) && targetIdx === idx;
          });
          
          if (targetEx && targetEx.id) {
            const currentId = exerciseIdMap.get(ex.id);
            const targetId = exerciseIdMap.get(targetEx.id);
            if (currentId && targetId) {
              await updateExercise({
                id: currentId,
                supersetWith: targetId,
              });
            }
          }
        } else if (ex.id) {
          // Clear superset if it was removed
          const currentId = exerciseIdMap.get(ex.id);
          if (currentId) {
            const currentEx = workout.exercises?.find((e) => e._id === ex.id);
            if (currentEx?.supersetWith) {
              await updateExercise({
                id: currentId,
                supersetWith: null,
              });
            }
          }
        }
      }
      
      router.push(`/workout-plans/${slug}`);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update workout');
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
        <Text>Please sign in to edit a workout</Text>
      </View>
    );
  }

  if (workout === undefined || exercises === undefined || plan === undefined) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-muted-foreground">Loading...</Text>
      </View>
    );
  }

  if (!workout || !plan) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-center text-muted-foreground mb-4">
          Workout not found
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
              <Button variant="outline" size="sm" onPress={addExerciseForm}>
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
                <Button variant="outline" onPress={addExerciseForm}>
                  <Icon as={Plus} className="size-4 mr-2" />
                  <Text>Add Exercise</Text>
                </Button>
              </View>
            ) : (
              <View className="gap-4">
                <DraggableFlatList
                  data={workoutExercises}
                  onDragEnd={handleDragEnd}
                  keyExtractor={(item) => item.id || `temp-${item.exerciseId || 'new'}`}
                  ItemSeparatorComponent={() => <View className="h-4" />}
                  renderItem={({ item, index, drag, isActive }: RenderItemParams<ExerciseForm>) => {
                    // Ensure index is a valid number (fallback to finding it in array if needed)
                    const displayIndex = typeof index === 'number' && !isNaN(index) 
                      ? index 
                      : workoutExercises.findIndex((ex) => ex.id === item.id || ex === item);
                    
                    // Check if this exercise is superset with next exercise
                    const nextExercise = workoutExercises[displayIndex + 1];
                    // Check if connected to next exercise (either direction)
                    const isSupersetWithNext = 
                      (item.supersetWith && (item.supersetWith === nextExercise?.id || parseInt(item.supersetWith) === displayIndex + 1)) ||
                      (nextExercise?.supersetWith && (nextExercise.supersetWith === item.id || parseInt(nextExercise.supersetWith) === displayIndex));
                    
                    return (
                      <ScaleDecorator>
                        <View>
                          <Card
                            className={`border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${
                              isActive ? 'opacity-80' : ''
                            }`}
                          >
                            <CardHeader>
                              <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center gap-2 flex-1">
                                  <Pressable onPressIn={drag} className="p-2 -ml-2">
                                    <Icon as={GripVertical} className="size-5 text-zinc-400 dark:text-zinc-600" />
                                  </Pressable>
                                  <CardTitle className="text-black dark:text-zinc-50">
                                    Exercise {displayIndex + 1}
                                  </CardTitle>
                                </View>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onPress={() => removeExerciseForm(displayIndex)}
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
                                    setPickingForIndex(displayIndex);
                                    setShowExercisePicker(true);
                                  }}
                                >
                                  <Text>
                                    {item.exerciseId
                                      ? exercises?.find((e) => e._id === item.exerciseId)?.name ||
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
                                    value={item.sets}
                                    onChangeText={(text) => updateExerciseForm(displayIndex, 'sets', text)}
                                  />
                                </View>
                                <View className="flex-1 gap-2">
                                  <Text className="text-sm font-medium text-black dark:text-zinc-50">
                                    Reps
                                  </Text>
                                  <Input
                                    keyboardType="numeric"
                                    value={item.reps}
                                    onChangeText={(text) => updateExerciseForm(displayIndex, 'reps', text)}
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
                                    value={item.weight}
                                    onChangeText={(text) => updateExerciseForm(displayIndex, 'weight', text)}
                                  />
                                </View>
                                <View className="flex-1 gap-2">
                                  <Text className="text-sm font-medium text-black dark:text-zinc-50">
                                    Rest (sec)
                                  </Text>
                                  <Input
                                    keyboardType="numeric"
                                    value={item.restTime}
                                    onChangeText={(text) => updateExerciseForm(displayIndex, 'restTime', text)}
                                  />
                                </View>
                              </View>
                              <View className="gap-2">
                                <Text className="text-sm font-medium text-black dark:text-zinc-50">
                                  Options
                                </Text>
                                <View className="flex-row gap-2">
                                  <Button
                                    variant={item.supersetWith ? 'default' : 'outline'}
                                    className="flex-1"
                                    onPress={() => {
                                      if (item.supersetWith) {
                                        updateExerciseForm(displayIndex, 'supersetWith', null);
                                      } else {
                                        // Toggle superset - connect to next exercise if available
                                        if (displayIndex < workoutExercises.length - 1) {
                                          const nextEx = workoutExercises[displayIndex + 1];
                                          updateExerciseForm(displayIndex, 'supersetWith', nextEx.id || (displayIndex + 1).toString());
                                        } else if (displayIndex > 0) {
                                          const prevEx = workoutExercises[displayIndex - 1];
                                          updateExerciseForm(displayIndex, 'supersetWith', prevEx.id || (displayIndex - 1).toString());
                                        }
                                      }
                                    }}
                                  >
                                    <Icon as={Link} className="size-4 mr-2" />
                                    <Text>
                                      {item.supersetWith
                                        ? (() => {
                                            const targetIdx = workoutExercises.findIndex((e) => e.id === item.supersetWith);
                                            return targetIdx >= 0 ? `Superset with Exercise ${targetIdx + 1}` : 'Superset';
                                          })()
                                        : 'Add Superset'}
                                    </Text>
                                  </Button>
                                </View>
                                {item.supersetWith && (
                                  <View className="mt-2">
                                    <Text className="text-xs text-muted-foreground">
                                      Connected to another exercise
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </CardContent>
                          </Card>
                          {/* Link icon below if superset with next (shows connection between exercises) */}
                          {isSupersetWithNext && (
                            <View className="items-center mt-2">
                              <Icon as={Link} className="size-4 text-zinc-500 dark:text-zinc-400" />
                            </View>
                          )}
                        </View>
                      </ScaleDecorator>
                    );
                  }}
                  scrollEnabled={false}
                />
                <Button variant="outline" onPress={addExerciseForm}>
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
            <Text>{isSubmitting ? 'Saving...' : 'Save Changes'}</Text>
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
                            updateExerciseForm(pickingForIndex, 'exerciseId', item._id);
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

