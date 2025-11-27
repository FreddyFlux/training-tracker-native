import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus, Play, CheckCircle2, Calendar, Dumbbell, Edit } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as React from 'react';
import { useState } from 'react';

export default function WorkoutPlanDetailScreen() {
  const { user, isLoaded } = useUser();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  
  const plan = useQuery(api.workoutPlans.getWithWorkoutsBySlug, { slug: slug || '' });
  const activeWorkout = useQuery(api.workoutLogs.getActive);
  const nextWorkout = useQuery(
    api.workoutPlans.getNextIncompleteWorkout,
    plan ? { planId: plan._id } : 'skip'
  );
  
  const activatePlan = useMutation(api.workoutPlans.activate);
  const startWorkout = useMutation(api.workoutLogs.startFromPlan);
  const [isActivating, setIsActivating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  async function handleActivate() {
    if (!plan) return;
    setIsActivating(true);
    try {
      await activatePlan({ id: plan._id });
      Alert.alert('Success', 'Workout plan activated');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to activate workout plan');
    } finally {
      setIsActivating(false);
    }
  }

  async function handleStartWorkout() {
    if (!plan || !nextWorkout) {
      Alert.alert('Error', 'No workout available to start');
      return;
    }
    
    setIsStarting(true);
    try {
      await startWorkout({
        planId: plan._id,
        workoutId: nextWorkout._id,
      });
      router.push('/active-workout');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to start workout');
    } finally {
      setIsStarting(false);
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
        <Text>Please sign in to access your workout plan</Text>
      </View>
    );
  }

  if (plan === undefined || nextWorkout === undefined) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-muted-foreground">Loading workout plan...</Text>
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
          <Text>Back to Plans</Text>
        </Button>
      </View>
    );
  }

  return (
      <ScrollView 
        className="flex-1 bg-zinc-50 dark:bg-black" 
        contentContainerClassName="p-4 gap-4"
      >
        {/* Plan Info */}
        <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader>
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-2">
                  <CardTitle className="text-2xl font-semibold text-black dark:text-zinc-50">
                    {plan.name}
                  </CardTitle>
                  {plan.isActive && (
                    <Badge variant="default" className="text-xs">
                      Active
                    </Badge>
                  )}
                </View>
                {plan.description && (
                  <Text className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {plan.description}
                  </Text>
                )}
                <View className="flex-row flex-wrap items-center gap-4">
                  <View className="flex-row items-center gap-2">
                    <Calendar size={16} color="#71717a" />
                    <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                      {plan.workoutsPerWeek}{' '}
                      {plan.workoutsPerWeek === 1 ? 'workout' : 'workouts'} per week
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Dumbbell size={16} color="#71717a" />
                    <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                      {plan.workouts.length}{' '}
                      {plan.workouts.length === 1 ? 'workout' : 'workouts'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </CardHeader>
          <CardContent className="gap-3">
            {!plan.isActive ? (
              <Button onPress={handleActivate} disabled={isActivating}>
                <Icon as={CheckCircle2} className="size-5 mr-2" />
                <Text>{isActivating ? 'Activating...' : 'Activate Plan'}</Text>
              </Button>
            ) : (
              <>
                {activeWorkout ? (
                  <Button onPress={() => router.push('/active-workout')}>
                    <Icon as={Play} className="size-5 mr-2" />
                    <Text>Continue Workout</Text>
                  </Button>
                ) : nextWorkout ? (
                  <Button onPress={handleStartWorkout} disabled={isStarting}>
                    <Icon as={Play} className="size-5 mr-2" />
                    <Text>{isStarting ? 'Starting...' : 'Start Workout'}</Text>
                  </Button>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {/* Workouts */}
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xl font-semibold text-black dark:text-zinc-50">Workouts</Text>
              <Text className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {plan.workouts.length} of {plan.workoutsPerWeek} workouts created
              </Text>
            </View>
            {plan.workouts.length < plan.workoutsPerWeek && (
              <Button
                onPress={() => router.push(`/workout-plans/${slug}/workout/new`)}
              >
                <Icon as={Plus} className="size-5 mr-2" />
                <Text>Add Workout</Text>
              </Button>
            )}
          </View>

          {plan.workouts.length === 0 ? (
            <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <CardContent className="items-center py-12">
                <Text className="text-center text-muted-foreground mb-4">
                  No workouts yet. Add your first workout to get started.
                </Text>
                <Button onPress={() => router.push(`/workout-plans/${slug}/workout/new`)}>
                  <Icon as={Plus} className="size-5 mr-2" />
                  <Text>Add Workout</Text>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <View className="gap-4">
              {plan.workouts.map((workout) => {
                const isNext = nextWorkout?._id === workout._id;
                return (
                  <Card
                    key={workout._id}
                    className={`border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${
                      isNext ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    <CardHeader>
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2 mb-2">
                            <CardTitle className="text-lg font-semibold text-black dark:text-zinc-50">
                              Workout {workout.workoutNumber}: {workout.name}
                            </CardTitle>
                            {isNext && (
                              <Badge variant="default" className="text-xs bg-blue-600">
                                Next
                              </Badge>
                            )}
                          </View>
                          {workout.exercises && workout.exercises.length > 0 && (
                            <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                              {workout.exercises.length}{' '}
                              {workout.exercises.length === 1 ? 'exercise' : 'exercises'}
                            </Text>
                          )}
                        </View>
                      </View>
                    </CardHeader>
                    <CardContent>
                      <View className="flex-row gap-2">
                        <Button
                          variant="outline"
                          onPress={() =>
                            router.push(`/workout-plans/${slug}/workout/${workout.workoutNumber}/edit`)
                          }
                          className="flex-1"
                        >
                          <Icon as={Edit} className="size-4 mr-2" />
                          <Text>Edit</Text>
                        </Button>
                        {isNext && (
                          <Button
                            onPress={handleStartWorkout}
                            disabled={isStarting}
                            className="flex-1"
                          >
                            <Icon as={Play} className="size-4 mr-2" />
                            <Text>Start</Text>
                          </Button>
                        )}
                      </View>
                    </CardContent>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
  );
}

