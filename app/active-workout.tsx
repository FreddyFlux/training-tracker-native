import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Stack, router } from 'expo-router';
import { ArrowLeft, Check, Plus, X, ChevronUp, ChevronDown } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';

export default function ActiveWorkoutScreen() {
  const { user, isLoaded } = useUser();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  
  const activeWorkout = useQuery(api.workoutLogs.getActiveWithDetails);
  const logSet = useMutation(api.workoutLogs.logSet);
  const updateSet = useMutation(api.workoutLogs.updateSet);
  const deleteSet = useMutation(api.workoutLogs.deleteSet);
  const completeWorkout = useMutation(api.workoutLogs.complete);

  const SCREEN_OPTIONS = useMemo(() => {
    const handleBackPress = () => {
      if (activeWorkout?.planSlug) {
        router.push(`/workout-plans/${activeWorkout.planSlug}`);
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.push('/dashboard');
      }
    };

    return {
      headerShown: true,
      title: 'Active Workout',
      headerBackTitleVisible: false,
      headerBackVisible: true,
      headerLeft: () => (
        <View style={{ paddingLeft: Platform.OS === 'ios' ? 0 : 8 }}>
          <Button
            variant="ghost"
            size="icon"
            onPress={handleBackPress}
            className="rounded-full">
            <Icon as={ArrowLeft} className="size-6" />
          </Button>
        </View>
      ),
      headerStyle: {
        backgroundColor: colorScheme === 'dark' ? '#18181b' : '#ffffff',
      },
      headerTintColor: colorScheme === 'dark' ? '#fafafa' : '#09090b',
      headerTitleStyle: {
        fontWeight: '600',
      },
    };
  }, [activeWorkout?.planSlug, colorScheme]);
  
  const [editingSets, setEditingSets] = useState<Record<string, Array<{ reps: number; weight: number }>>>({});
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());
  const scrollViewRef = useRef<ScrollView>(null);
  const exerciseRefs = useRef<Record<string, View>>({});
  const previousCompletedCountsRef = useRef<Record<string, number>>({});

  // Initialize editing sets from workout template
  useEffect(() => {
    if (activeWorkout?.workout?.exercises) {
      const newEditingSets: Record<string, Array<{ reps: number; weight: number }>> = {};
      for (const ex of activeWorkout.workout.exercises) {
        const exerciseId = ex.exerciseId;
        const completedSets = activeWorkout.setsByExercise[exerciseId] || [];
        
        // Build sets array from template or completed sets
        const setsArray: Array<{ reps: number; weight: number }> = [];
        const totalSets = ex.sets;
        
        for (let i = 0; i < totalSets; i++) {
          const completedSet = completedSets.find((s) => s.setNumber === i + 1);
          setsArray.push({
            reps: completedSet?.reps ?? ex.reps,
            weight: completedSet?.weight ?? ex.weight,
          });
        }
        
        newEditingSets[exerciseId] = setsArray;
      }
      setEditingSets(newEditingSets);
    }
  }, [activeWorkout?.workout?._id]);

  // Auto-expand first incomplete exercise on mount
  useEffect(() => {
    if (activeWorkout?.workout?.exercises && expandedExercises.size === 0) {
      const firstIncomplete = activeWorkout.workout.exercises.find((ex) => {
        const completedSets = activeWorkout.setsByExercise[ex.exerciseId] || [];
        const totalSets = editingSets[ex.exerciseId]?.length || ex.sets;
        return completedSets.length < totalSets;
      });
      
      if (firstIncomplete) {
        setExpandedExercises(new Set([firstIncomplete.exerciseId]));
      }
    }
  }, [activeWorkout?.workout?.exercises, editingSets]);

  // Watch for exercise completion changes and auto-collapse/scroll
  useEffect(() => {
    if (!activeWorkout?.workout?.exercises) return;

    const exercises = activeWorkout.workout.exercises;
    const currentCompletedCounts: Record<string, number> = {};
    
    exercises.forEach((ex) => {
      const exerciseId = ex.exerciseId;
      const completedSets = activeWorkout.setsByExercise[exerciseId] || [];
      currentCompletedCounts[exerciseId] = completedSets.length;
      
      const totalSets = editingSets[exerciseId]?.length || ex.sets;
      const isComplete = completedSets.length >= totalSets;
      const wasComplete = (previousCompletedCountsRef.current[exerciseId] || 0) >= totalSets;
      const justCompleted = isComplete && !wasComplete;

      // If exercise just became complete and is expanded, collapse it and move to next
      if (justCompleted && expandedExercises.has(exerciseId)) {
        const newExpanded = new Set(expandedExercises);
        newExpanded.delete(exerciseId);

        // Find the next incomplete exercise
        const currentIndex = exercises.findIndex(e => e.exerciseId === exerciseId);
        let nextIncompleteId: string | null = null;

        // Find next incomplete exercise after the current one
        for (let i = currentIndex + 1; i < exercises.length; i++) {
          const nextEx = exercises[i];
          const nextCompletedSets = activeWorkout.setsByExercise[nextEx.exerciseId] || [];
          const nextTotalSets = editingSets[nextEx.exerciseId]?.length || nextEx.sets;
          if (nextCompletedSets.length < nextTotalSets) {
            nextIncompleteId = nextEx.exerciseId;
            newExpanded.add(nextEx.exerciseId);
            break;
          }
        }

        // If no next exercise found, try finding the first incomplete from the start
        if (!nextIncompleteId) {
          for (const nextEx of exercises) {
            const nextCompletedSets = activeWorkout.setsByExercise[nextEx.exerciseId] || [];
            const nextTotalSets = editingSets[nextEx.exerciseId]?.length || nextEx.sets;
            if (nextCompletedSets.length < nextTotalSets) {
              nextIncompleteId = nextEx.exerciseId;
              newExpanded.add(nextEx.exerciseId);
              break;
            }
          }
        }

        // Update expanded state
        setExpandedExercises(newExpanded);

        // Scroll to next incomplete exercise after a short delay
        if (nextIncompleteId) {
          setTimeout(() => {
            const ref = exerciseRefs.current[nextIncompleteId!];
            if (ref && scrollViewRef.current) {
              ref.measureLayout(
                scrollViewRef.current as any,
                (x, y) => {
                  scrollViewRef.current?.scrollTo({
                    y: y - 20, // Add some padding from top
                    animated: true,
                  });
                },
                () => {
                  // Fallback if measureLayout fails
                  console.log('Failed to measure layout');
                }
              );
            }
          }, 300); // Small delay to allow collapse animation
        }
      }
    });

    // Update the ref with current counts
    previousCompletedCountsRef.current = currentCompletedCounts;
  }, [activeWorkout?.setsByExercise, editingSets]);

  // Total timer
  useEffect(() => {
    if (!activeWorkout) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - activeWorkout.startedAt) / 1000);
      setTotalElapsed(elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout?.startedAt]);

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function toggleExercise(exerciseId: string) {
    const newExpanded = new Set(expandedExercises);
    if (newExpanded.has(exerciseId)) {
      newExpanded.delete(exerciseId);
    } else {
      newExpanded.add(exerciseId);
    }
    setExpandedExercises(newExpanded);
  }

  async function handleCompleteSet(exerciseId: string, setNumber: number) {
    if (!activeWorkout) return;
    
    try {
      const editingSet = editingSets[exerciseId]?.[setNumber - 1];
      if (!editingSet) return;

      const existingSets = activeWorkout.setsByExercise[exerciseId] || [];
      const existingSet = existingSets.find((s) => s.setNumber === setNumber);

      if (existingSet) {
        await updateSet({
          id: existingSet._id,
          reps: editingSet.reps,
          weight: editingSet.weight,
        });
      } else {
        await logSet({
          workoutLogId: activeWorkout._id,
          exerciseId: exerciseId as any,
          setNumber,
          reps: editingSet.reps,
          weight: editingSet.weight,
        });
      }
      // The useEffect will handle auto-collapse and scroll when the query updates
    } catch (error) {
      console.error('Failed to complete set:', error);
    }
  }

  function updateSetValue(
    exerciseId: string,
    setNumber: number,
    field: 'reps' | 'weight',
    value: number
  ) {
    const currentSets = editingSets[exerciseId] || [];
    const newSets = [...currentSets];
    newSets[setNumber - 1] = {
      ...newSets[setNumber - 1],
      [field]: value,
    };
    setEditingSets({
      ...editingSets,
      [exerciseId]: newSets,
    });
  }

  async function handleCompleteWorkout() {
    if (!activeWorkout) return;
    try {
      await completeWorkout({ id: activeWorkout._id });
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to complete workout:', error);
    }
  }

  if (!isLoaded) {
    return (
      <>
        <Stack.Screen options={SCREEN_OPTIONS} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Stack.Screen options={SCREEN_OPTIONS} />
        <View className="flex-1 items-center justify-center">
          <Text>Please sign in to access your workout</Text>
        </View>
      </>
    );
  }

  if (activeWorkout === undefined) {
    return (
      <>
        <Stack.Screen options={SCREEN_OPTIONS} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-muted-foreground">Loading workout...</Text>
        </View>
      </>
    );
  }

  if (!activeWorkout) {
    return (
      <>
        <Stack.Screen options={SCREEN_OPTIONS} />
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-center text-muted-foreground mb-4">
            No active workout found
          </Text>
          <Button onPress={() => router.push('/dashboard')}>
            <Text>Go to Dashboard</Text>
          </Button>
        </View>
      </>
    );
  }

  if (!activeWorkout.workout) {
    return (
      <>
        <Stack.Screen options={SCREEN_OPTIONS} />
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-center text-muted-foreground">
            No workout template found
          </Text>
        </View>
      </>
    );
  }

  const allExercisesComplete =
    activeWorkout.workout.exercises?.every((ex) => {
      const completedSets = activeWorkout.setsByExercise[ex.exerciseId] || [];
      const totalSets = editingSets[ex.exerciseId]?.length || ex.sets;
      return completedSets.length >= totalSets;
    }) ?? false;

  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />
      <ScrollView 
        ref={scrollViewRef}
        className="flex-1 bg-zinc-50 dark:bg-black" 
        contentContainerClassName="p-4 gap-4"
        style={{ paddingTop: insets.top }}
      >
        {/* Timer */}
        <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-black dark:text-zinc-50">Workout Timer</CardTitle>
          </CardHeader>
          <CardContent>
            <View>
              <Text className="text-sm text-zinc-600 dark:text-zinc-400">Total Time</Text>
              <Text className="text-3xl font-bold text-black dark:text-zinc-50">
                {formatTime(totalElapsed)}
              </Text>
            </View>
          </CardContent>
        </Card>

        {/* Exercises */}
        <View className="gap-4">
          {activeWorkout.workout.exercises?.map((exercise, index) => {
            const exerciseId = exercise.exerciseId;
            const isExpanded = expandedExercises.has(exerciseId);
            const completedSets = activeWorkout.setsByExercise[exerciseId] || [];
            const sets = editingSets[exerciseId] || [];
            const exerciseComplete = sets.length > 0 && completedSets.length >= sets.length;

            return (
              <View
                key={exerciseId}
                ref={(ref) => {
                  if (ref) {
                    exerciseRefs.current[exerciseId] = ref;
                  }
                }}
              >
                <Card
                  className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                >
                <CardHeader>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3 flex-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => toggleExercise(exerciseId)}
                      >
                        <Icon as={isExpanded ? ChevronUp : ChevronDown} className="size-4" />
                      </Button>
                      <View className="flex-1">
                        <CardTitle className="text-lg text-black dark:text-zinc-50">
                          {index + 1}. {exercise.exercise?.name || 'Unknown Exercise'}
                        </CardTitle>
                        <View className="flex-row items-center gap-2 mt-1">
                          {exerciseComplete && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              Complete
                            </Badge>
                          )}
                          {exercise.exercise?.muscleGroup && (
                            <Badge variant="secondary" className="text-xs">
                              {exercise.exercise.muscleGroup}
                            </Badge>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="gap-3">
                    {sets.map((set, setIdx) => {
                      const setNumber = setIdx + 1;
                      const completedSet = completedSets.find((s) => s.setNumber === setNumber);
                      const isCompleted = !!completedSet;

                      return (
                        <View
                          key={setIdx}
                          className="flex-row items-center gap-2 p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                        >
                          <Text className="font-medium w-8 text-black dark:text-zinc-50">
                            Set {setNumber}
                          </Text>
                          <Input
                            keyboardType="numeric"
                            placeholder="Reps"
                            value={set.reps.toString()}
                            onChangeText={(text) =>
                              updateSetValue(exerciseId, setNumber, 'reps', parseInt(text) || 0)
                            }
                            className="w-20"
                            editable={!isCompleted}
                          />
                          <Text className="text-zinc-600 dark:text-zinc-400">×</Text>
                          <Input
                            keyboardType="numeric"
                            placeholder="Weight"
                            value={set.weight.toString()}
                            onChangeText={(text) =>
                              updateSetValue(exerciseId, setNumber, 'weight', parseFloat(text) || 0)
                            }
                            className="w-20"
                            editable={!isCompleted}
                          />
                          <Text className="text-zinc-600 dark:text-zinc-400">kg</Text>
                          <View className="flex-1" />
                          {!isCompleted && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onPress={() => handleCompleteSet(exerciseId, setNumber)}
                            >
                              <Icon as={Check} className="size-4" />
                            </Button>
                          )}
                        </View>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
              </View>
            );
          })}
        </View>

        {/* Complete Workout Button */}
        {allExercisesComplete && (
          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardContent className="pt-6">
              <Button onPress={handleCompleteWorkout} size="lg" className="w-full">
                <Text>Complete Workout</Text>
              </Button>
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </>
  );
}

