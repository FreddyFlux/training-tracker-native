import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { UserMenu } from '@/components/user-menu';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Stack, router } from 'expo-router';
import { Calendar, Dumbbell, Plus, BarChart3, MoonStarIcon, SunIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as React from 'react';

const THEME_ICONS = {
  light: SunIcon,
  dark: MoonStarIcon,
};

function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  return (
    <Button onPress={toggleColorScheme} size="icon" variant="ghost" className="rounded-full">
      <Icon as={THEME_ICONS[colorScheme ?? 'light']} className="size-6" />
    </Button>
  );
}

function DashboardHeader() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center justify-between border-b border-border bg-background px-4 pb-2 web:mx-2"
      style={{ paddingTop: insets.top + 8 }}>
      <ThemeToggle />
      <UserMenu />
    </View>
  );
}

const SCREEN_OPTIONS = {
  headerShown: true,
  header: () => <DashboardHeader />,
};

export default function DashboardScreen() {
  const { user, isLoaded } = useUser();

  // Convex queries - using existing functions from the web app
  const currentUser = useQuery(api.users.getCurrentUser);
  const activePlan = useQuery(api.workoutPlans.getActive);
  const activeWorkout = useQuery(api.workoutLogs.getActive);
  const dashboardStats = useQuery(api.workoutLogs.getDashboardStats);
  const recentActivity = useQuery(api.workoutLogs.getRecentActivity, { limit: 5 });

  // Show loading state while Clerk or Convex data is loading
  const isConvexLoading =
    currentUser === undefined ||
    activePlan === undefined ||
    dashboardStats === undefined ||
    recentActivity === undefined;

  if (!isLoaded || isConvexLoading) {
    return (
      <>
        <Stack.Screen options={SCREEN_OPTIONS} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-muted-foreground">Loading your dashboard...</Text>
        </View>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Stack.Screen options={SCREEN_OPTIONS} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground">Please sign in to access your dashboard</Text>
        </View>
      </>
    );
  }

  // Ensure we have default values for stats
  const stats = dashboardStats ?? {
    totalWorkouts: 0,
    thisWeekWorkouts: 0,
    weeksStreak: 0,
  };

  // Ensure we have an array for recent activity
  const activity = recentActivity ?? [];

  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />
      <ScrollView className="flex-1 bg-zinc-50 dark:bg-black" contentContainerClassName="p-4 gap-4">
        {/* Header */}
        <View className="">
          <Text className="text-2xl font-bold text-black dark:text-zinc-50">Workout Plan</Text>
        </View>

        {/* Active Workout Plan or Create Plan */}
        <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {activePlan ? (
            <CardContent className="gap-4 pt-6">
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="mb-2 flex-row items-center gap-2">
                    <CardTitle className="text-2xl font-semibold text-black dark:text-zinc-50">
                      {activePlan.name}
                    </CardTitle>
                    <Badge variant="default" className="text-xs">
                      Active
                    </Badge>
                  </View>
                  {activePlan.description && (
                    <Text className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {activePlan.description}
                    </Text>
                  )}
                  <View className="flex-row flex-wrap items-center gap-4">
                    <View className="flex-row items-center gap-2">
                      <Calendar size={16} color="#71717a" />
                      <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                        {activePlan.workoutsPerWeek}{' '}
                        {activePlan.workoutsPerWeek === 1 ? 'workout' : 'workouts'} per week
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Dumbbell size={16} color="#71717a" />
                      <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                        {activePlan.workouts.length}{' '}
                        {activePlan.workouts.length === 1 ? 'workout' : 'workouts'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <View className="flex-row gap-3">
                <Button
                  size="lg"
                  onPress={() => {
                    if (activeWorkout) {
                      router.push('/active-workout');
                    } else {
                      router.push(`/workout-plans/${activePlan.slug}`);
                    }
                  }}>
                  <Dumbbell size={20} color="white" style={{ marginRight: 8 }} />
                  <Text>{activeWorkout ? 'Continue Workout' : 'Go to Workout'}</Text>
                </Button>
                <Button variant="outline" size="lg" onPress={() => router.push('/workout-plans')}>
                  <Text>View All Plans</Text>
                </Button>
              </View>
            </CardContent>
          ) : (
            <CardContent className="items-center py-8">
              <Dumbbell size={48} color="#a1a1aa" style={{ marginBottom: 16 }} />
              <CardTitle className="mb-2 text-2xl font-semibold text-black dark:text-zinc-50">
                No Active Workout Plan
              </CardTitle>
              <Text className="mb-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
                Create a workout plan to start tracking your training progress
              </Text>
              <View className="flex-row gap-3">
                <Button size="lg" onPress={() => router.push('/workout-plans')}>
                  <Plus size={20} color="white" style={{ marginRight: 8 }} />
                  <Text>Create Workout Plan</Text>
                </Button>
                <Button variant="outline" size="lg" onPress={() => router.push('/workout-plans')}>
                  <Text>View All Plans</Text>
                </Button>
              </View>
            </CardContent>
          )}
        </Card>

        {/* Dashboard Stats Grid */}
        <View className="flex-row flex-wrap gap-6">
          <Card className="min-w-[140px] flex-1 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardContent className="pt-6">
              <Text className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Total Workouts
              </Text>
              <Text className="text-3xl font-bold text-black dark:text-zinc-50">
                {stats.totalWorkouts}
              </Text>
              <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                {stats.totalWorkouts === 0
                  ? 'Start tracking your workouts'
                  : stats.totalWorkouts === 1
                    ? 'Workout completed'
                    : 'Workouts completed'}
              </Text>
            </CardContent>
          </Card>

          <Card className="min-w-[140px] flex-1 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardContent className="pt-6">
              <Text className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                This Week
              </Text>
              <Text className="text-3xl font-bold text-black dark:text-zinc-50">
                {stats.thisWeekWorkouts}
              </Text>
              <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                {stats.thisWeekWorkouts === 1 ? 'Workout completed' : 'Workouts completed'}
              </Text>
            </CardContent>
          </Card>

          <Card className="min-w-[140px] flex-1 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardContent className="pt-6">
              <Text className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Current Streak
              </Text>
              <Text className="text-3xl font-bold text-black dark:text-zinc-50">
                {stats.weeksStreak}
              </Text>
              <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                {stats.weeksStreak === 1 ? 'Week in a row' : 'Weeks in a row'}
              </Text>
            </CardContent>
          </Card>

          <Card className="min-w-[140px] flex-1 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardContent className="flex-1 flex-col pt-6">
              <Text className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Workout Stats
              </Text>
              <Text className="mb-4 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
                View detailed statistics and insights about your workout history
              </Text>
              <Button className="w-full" disabled>
                <BarChart3 size={16} color="white" style={{ marginRight: 8 }} />
                <Text>View Stats</Text>
              </Button>
            </CardContent>
          </Card>
        </View>

        {/* Recent Activity */}
        <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-black dark:text-zinc-50">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <View className="items-center justify-center py-12">
                <Text className="text-zinc-600 dark:text-zinc-400">
                  No workouts yet. Start your first workout to see it here!
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {activity.map((activityItem) => {
                  // Extract first name from full name
                  const getFirstName = (fullName?: string) => {
                    if (!fullName) return 'You';
                    return fullName.split(' ')[0];
                  };

                  // Get the view link based on activity type
                  const getViewLink = (): string => {
                    if (activityItem.type === 'workout_log') {
                      // Workout log detail page doesn't exist yet
                      return '/dashboard';
                    } else if (activityItem.type === 'shared_workout') {
                      // Shared workout page doesn't exist yet
                      return '/dashboard';
                    } else if (activityItem.type === 'shared_plan') {
                      return `/workout-plans/${activityItem.planSlug}`;
                    }
                    return '/dashboard';
                  };

                  // Format the activity description
                  const getActivityDescription = () => {
                    if (activityItem.type === 'workout_log') {
                      return activityItem.name;
                    } else if (activityItem.type === 'shared_workout') {
                      const firstName = getFirstName(activityItem.sharedByName);
                      return `${firstName} shared: ${activityItem.name}`;
                    } else if (activityItem.type === 'shared_plan') {
                      const firstName = getFirstName(activityItem.sharedByName);
                      return `${firstName} shared: ${activityItem.name}`;
                    }
                    return activityItem.name;
                  };

                  return (
                    <View
                      key={activityItem._id}
                      className="flex-row items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                      <View className="flex-1">
                        <Text className="font-medium text-black dark:text-zinc-50">
                          {getActivityDescription()}
                        </Text>
                        <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                          {new Date(activityItem.timestamp).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}{' '}
                          at{' '}
                          {new Date(activityItem.timestamp).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => router.push(getViewLink() as any)}>
                        <Text>View</Text>
                      </Button>
                    </View>
                  );
                })}
              </View>
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
