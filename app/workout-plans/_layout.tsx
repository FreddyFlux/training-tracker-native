import { Stack, router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { UserMenu } from '@/components/user-menu';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ArrowLeft } from 'lucide-react-native';
import { View, Platform } from 'react-native';

export default function WorkoutPlansLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
        headerStyle: {
          backgroundColor: colorScheme === 'dark' ? '#18181b' : '#ffffff',
        },
        headerTintColor: colorScheme === 'dark' ? '#fafafa' : '#09090b',
        headerTitleStyle: {
          fontWeight: '600',
        },
        // Enable native animations
        animation: 'default',
        // Enable native back button on Android
        headerBackVisible: true,
      }}>
      {/* Index screen - list of workout plans */}
      <Stack.Screen
        name="index"
        options={{
          title: 'Workout Plans',
          headerShown: true,
          headerLeft: () => (
            <View style={{ paddingLeft: Platform.OS === 'ios' ? 0 : 8 }}>
              <Button
                variant="ghost"
                size="icon"
                onPress={() => {
                  // Try to go back, if no history, navigate to dashboard
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.push('/dashboard');
                  }
                }}
                className="rounded-full">
                <Icon as={ArrowLeft} className="size-6" />
              </Button>
            </View>
          ),
          headerRight: () => (
            <View style={{ paddingRight: 8 }}>
              <UserMenu />
            </View>
          ),
        }}
      />
      
      {/* Plan detail screen */}
      <Stack.Screen
        name="[slug]"
        options={{
          title: 'Workout Plan',
          headerShown: true,
          headerLeft: () => (
            <View style={{ paddingLeft: Platform.OS === 'ios' ? 0 : 8 }}>
              <Button
                variant="ghost"
                size="icon"
                onPress={() => {
                  // Try to go back, if no history, navigate to dashboard
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.push('/dashboard');
                  }
                }}
                className="rounded-full">
                <Icon as={ArrowLeft} className="size-6" />
              </Button>
            </View>
          ),
        }}
      />
      
      {/* New workout screen */}
      <Stack.Screen
        name="[slug]/workout/new"
        options={{
          title: 'Create Workout',
          headerShown: true,
        }}
      />
      
      {/* Edit workout screen */}
      <Stack.Screen
        name="[slug]/workout/[number]/edit"
        options={{
          title: 'Edit Workout',
          headerShown: true,
        }}
      />
    </Stack>
  );
}

