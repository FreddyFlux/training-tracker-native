import { Stack } from 'expo-router';

const SIGN_UP_INDEX_SCREEN_OPTIONS = {
  title: 'Sign Up',
  headerBackTitleVisible: false,
};

const VERIFY_EMAIL_SCREEN_OPTIONS = {
  title: 'Verify Email',
  headerBackTitleVisible: false,
};

export default function SignUpLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitleVisible: false,
      }}>
      <Stack.Screen name="index" options={SIGN_UP_INDEX_SCREEN_OPTIONS} />
      <Stack.Screen name="verify-email" options={VERIFY_EMAIL_SCREEN_OPTIONS} />
    </Stack>
  );
}
