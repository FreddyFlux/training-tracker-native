import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { UserMenu } from '@/components/user-menu';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Stack, useRouter } from 'expo-router';
import { MoonStarIcon, XIcon, SunIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Image, type ImageStyle, View } from 'react-native';

const LOGO = {
  light: require('@/assets/images/react-native-reusables-light.png'),
  dark: require('@/assets/images/react-native-reusables-dark.png'),
};

const CLERK_LOGO = {
  light: require('@/assets/images/clerk-logo-light.png'),
  dark: require('@/assets/images/clerk-logo-dark.png'),
};

const LOGO_STYLE: ImageStyle = {
  height: 36,
  width: 40,
};

const SCREEN_OPTIONS = {
  header: () => (
    <View className="top-safe absolute left-0 right-0 flex-row justify-between px-4 py-2 web:mx-2">
      <ThemeToggle />
      <UserMenu />
    </View>
  ),
};

export default function Screen() {
  const { colorScheme } = useColorScheme();
  const { user } = useUser();
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/dashboard');
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />

      <View className="flex-1 items-center justify-center">
        <View>
          <Image
            source={require('@/assets/images/muscle-memory-logo.png')}
            style={{ width: 300, height: 300 }}
          />
        </View>
        <View className="mx-auto">
          <Text className="text-lg">Your growth partner for training,</Text>
          <Text className="text-lg">Make training plans with AI.</Text>
          <Text className="text-lg">Track your progress.</Text>
          <Text className="text-lg">Get personalized feedback.</Text>
        </View>
        {isLoaded && !isSignedIn && (
          <View className="mt-8 w-full max-w-sm gap-4 px-4">
            <Button className="w-full" onPress={() => router.push('/(auth)/sign-in')}>
              <Text>Login</Text>
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onPress={() => router.push('/(auth)/sign-up')}>
              <Text>Sign Up</Text>
            </Button>
          </View>
        )}
      </View>
    </>
  );
}

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
