import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useUser } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { router } from 'expo-router';
import { Plus, Calendar, Dumbbell } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, View, TextInput, Alert } from 'react-native';
import * as React from 'react';
import { useState } from 'react';

export default function WorkoutPlansScreen() {
  const { user, isLoaded } = useUser();
  
  const plans = useQuery(api.workoutPlans.list);
  const createPlan = useMutation(api.workoutPlans.create);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [workoutsPerWeek, setWorkoutsPerWeek] = useState('3');
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreatePlan() {
    if (!planName.trim()) {
      Alert.alert('Error', 'Please enter a plan name');
      return;
    }

    const workoutsPerWeekNum = parseInt(workoutsPerWeek);
    if (isNaN(workoutsPerWeekNum) || workoutsPerWeekNum < 1 || workoutsPerWeekNum > 10) {
      Alert.alert('Error', 'Workouts per week must be between 1 and 10');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createPlan({
        name: planName.trim(),
        description: planDescription.trim() || undefined,
        workoutsPerWeek: workoutsPerWeekNum,
      });
      setShowCreateDialog(false);
      setPlanName('');
      setPlanDescription('');
      setWorkoutsPerWeek('3');
      router.push(`/workout-plans/${result.slug}`);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create plan');
    } finally {
      setIsCreating(false);
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
        <Text>Please sign in to access your workout plans</Text>
      </View>
    );
  }

  if (plans === undefined) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-muted-foreground">Loading workout plans...</Text>
      </View>
    );
  }

  return (
      <ScrollView 
        className="flex-1 bg-zinc-50 dark:bg-black" 
        contentContainerClassName="p-4 gap-4"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-black dark:text-zinc-50">Your Plans</Text>
            <Text className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Create and manage your training programs
            </Text>
          </View>
          <Button onPress={() => setShowCreateDialog(true)}>
            <Icon as={Plus} className="size-5 mr-2" />
            <Text>Create</Text>
          </Button>
        </View>

        {/* Create Plan Dialog */}
        {showCreateDialog && (
          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-black dark:text-zinc-50">Create Workout Plan</CardTitle>
            </CardHeader>
            <CardContent className="gap-4">
              <View className="gap-2">
                <Text className="text-sm font-medium text-black dark:text-zinc-50">Name</Text>
                <Input
                  placeholder="e.g. Push Pull Legs"
                  value={planName}
                  onChangeText={setPlanName}
                />
              </View>
              <View className="gap-2">
                <Text className="text-sm font-medium text-black dark:text-zinc-50">
                  Description (Optional)
                </Text>
                <TextInput
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground"
                  placeholder="Describe your training program..."
                  value={planDescription}
                  onChangeText={setPlanDescription}
                  multiline
                  textAlignVertical="top"
                />
              </View>
              <View className="gap-2">
                <Text className="text-sm font-medium text-black dark:text-zinc-50">
                  Workouts per Week
                </Text>
                <Input
                  keyboardType="numeric"
                  placeholder="3"
                  value={workoutsPerWeek}
                  onChangeText={setWorkoutsPerWeek}
                />
                <Text className="text-xs text-zinc-600 dark:text-zinc-400">
                  How many workouts per week? (1-10)
                </Text>
              </View>
              <View className="flex-row gap-2">
                <Button
                  variant="outline"
                  onPress={() => {
                    setShowCreateDialog(false);
                    setPlanName('');
                    setPlanDescription('');
                    setWorkoutsPerWeek('3');
                  }}
                  className="flex-1"
                >
                  <Text>Cancel</Text>
                </Button>
                <Button
                  onPress={handleCreatePlan}
                  disabled={isCreating}
                  className="flex-1"
                >
                  <Text>{isCreating ? 'Creating...' : 'Create Plan'}</Text>
                </Button>
              </View>
            </CardContent>
          </Card>
        )}

        {/* Plans List */}
        {plans.length === 0 ? (
          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardContent className="items-center py-12">
              <Dumbbell size={48} color="#a1a1aa" style={{ marginBottom: 16 }} />
              <Text className="text-center text-muted-foreground mb-4">
                You haven't created any workout plans yet.
              </Text>
              <Button onPress={() => setShowCreateDialog(true)}>
                <Icon as={Plus} className="size-5 mr-2" />
                <Text>Create Plan</Text>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <View className="gap-4">
            {plans.map((plan) => (
              <Card
                key={plan._id}
                className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                <CardHeader>
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-2">
                        <CardTitle className="text-xl font-semibold text-black dark:text-zinc-50">
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
                      </View>
                    </View>
                  </View>
                </CardHeader>
                <CardContent>
                  <Button
                    size="lg"
                    onPress={() => router.push(`/workout-plans/${plan.slug}`)}
                    className="w-full"
                  >
                    <Icon as={Dumbbell} className="size-5 mr-2" />
                    <Text>View Plan</Text>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
  );
}

