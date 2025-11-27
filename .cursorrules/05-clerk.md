# Clerk Authentication

## Setup

- Use `@clerk/clerk-expo` for React Native
- Environment variable: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Use `tokenCache` from `@clerk/clerk-expo/token-cache` for secure token storage

## Provider Setup

```typescript
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error('Missing Clerk Publishable Key');
}

<ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
  {children}
</ClerkProvider>
```

## Authentication Hooks

### useAuth - Check Auth State

```typescript
import { useAuth } from '@clerk/clerk-expo';

function MyComponent() {
  const { isSignedIn, isLoaded, userId } = useAuth();

  // Always check isLoaded before using auth state
  if (!isLoaded) {
    return <ActivityIndicator />;
  }

  if (!isSignedIn) {
    return <Text>Please sign in</Text>;
  }

  return <Text>Welcome! User ID: {userId}</Text>;
}
```

### useUser - Get User Data

```typescript
import { useUser } from '@clerk/clerk-expo';

function MyComponent() {
  const { user, isLoaded } = useUser();

  if (!isLoaded || !user) {
    return <ActivityIndicator />;
  }

  return (
    <View>
      <Text>Email: {user.emailAddresses[0].emailAddress}</Text>
      <Text>Name: {user.firstName} {user.lastName}</Text>
    </View>
  );
}
```

### useSignIn - Sign In

```typescript
import { useSignIn } from '@clerk/clerk-expo';
import { router } from 'expo-router';

function SignInForm() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit() {
    if (!isLoaded) return;

    try {
      const signInAttempt = await signIn.create({
        identifier: email,
        password,
      });

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace('/(tabs)');
      } else {
        // Handle other statuses (e.g., needs verification)
        console.log('Sign in status:', signInAttempt.status);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  }

  return (
    <View>
      {/* Form fields */}
      {error && <Text className="text-destructive">{error}</Text>}
      <Button onPress={onSubmit}>Sign In</Button>
    </View>
  );
}
```

### useSignUp - Sign Up

```typescript
import { useSignUp } from '@clerk/clerk-expo';
import { router } from 'expo-router';

function SignUpForm() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit() {
    if (!isLoaded) return;

    try {
      await signUp.create({
        emailAddress: email,
        password,
      });

      // Send verification email
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      
      router.push('/(auth)/verify-email');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  }

  return (
    <View>
      {/* Form fields */}
      {error && <Text className="text-destructive">{error}</Text>}
      <Button onPress={onSubmit}>Sign Up</Button>
    </View>
  );
}
```

## Sign In Pattern

```typescript
const { signIn, setActive, isLoaded } = useSignIn();
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [error, setError] = useState<{ email?: string; password?: string }>({});

async function onSubmit() {
  if (!isLoaded) return;

  try {
    const signInAttempt = await signIn.create({
      identifier: email,
      password,
    });

    if (signInAttempt.status === 'complete') {
      await setActive({ session: signInAttempt.createdSessionId });
      router.replace('/(tabs)');
    }
  } catch (err) {
    if (err instanceof Error) {
      const isEmailMessage =
        err.message.toLowerCase().includes('identifier') ||
        err.message.toLowerCase().includes('email');
      setError(
        isEmailMessage
          ? { email: err.message }
          : { password: err.message }
      );
    }
  }
}
```

## Sign Up Pattern

```typescript
const { signUp, setActive, isLoaded } = useSignUp();

async function onSubmit() {
  if (!isLoaded) return;

  try {
    await signUp.create({
      emailAddress: email,
      password,
    });

    await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    router.push('/(auth)/verify-email');
  } catch (err) {
    if (err instanceof Error) {
      setError(err.message);
    }
  }
}
```

## Email Verification Pattern

```typescript
import { useSignUp } from '@clerk/clerk-expo';
import { useLocalSearchParams } from 'expo-router';

function VerifyEmailForm() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  async function onSubmit() {
    if (!isLoaded) return;

    try {
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (signUpAttempt.status === 'complete') {
        await setActive({ session: signUpAttempt.createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  }

  async function onResendCode() {
    if (!isLoaded) return;
    await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
  }

  return (
    <View>
      <Input
        value={code}
        onChangeText={setCode}
        placeholder="Verification code"
        keyboardType="number-pad"
      />
      {error && <Text className="text-destructive">{error}</Text>}
      <Button onPress={onSubmit}>Verify</Button>
      <Button onPress={onResendCode} variant="outline">
        Resend Code
      </Button>
    </View>
  );
}
```

## Social Authentication

```typescript
import { useOAuth } from '@clerk/clerk-expo';
import { router } from 'expo-router';

function SocialSignIn() {
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const [isLoading, setIsLoading] = useState(false);

  const handleSocialSignIn = async () => {
    setIsLoading(true);
    try {
      const { createdSessionId, setActive } = await startOAuthFlow();
      if (createdSessionId) {
        await setActive({ session: createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err) {
      console.error('OAuth error', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onPress={handleSocialSignIn} disabled={isLoading}>
      <Text>Sign in with Google</Text>
    </Button>
  );
}
```

### Available OAuth Strategies

- `oauth_google`
- `oauth_apple`
- `oauth_github`
- `oauth_facebook`
- `oauth_microsoft`

## Protected Routes

### Using Stack.Protected

```typescript
// In app/_layout.tsx
import { Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

function Routes() {
  const { isSignedIn } = useAuth();

  return (
    <Stack>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="dashboard" />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)/sign-in" />
        <Stack.Screen name="(auth)/sign-up" />
      </Stack.Protected>
    </Stack>
  );
}
```

### Checking Auth in Components

```typescript
import { useAuth } from '@clerk/clerk-expo';

function ProtectedComponent() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return <ActivityIndicator />;
  }

  if (!isSignedIn) {
    return <Text>Please sign in</Text>;
  }

  return <View>{/* Protected content */}</View>;
}
```

## User Data

### Accessing User Properties

```typescript
const { user } = useUser();

// Email
const email = user?.emailAddresses[0]?.emailAddress;

// Name
const firstName = user?.firstName;
const lastName = user?.lastName;
const fullName = user?.fullName;

// User ID (matches Convex identity.subject)
const userId = user?.id;

// Profile image
const imageUrl = user?.imageUrl;
```

### User ID for Convex

- Use `user.id` from Clerk to match with Convex `userId` (from `identity.subject`)
- Both represent the same user identifier

## Sign Out

```typescript
import { useAuth } from '@clerk/clerk-expo';
import { router } from 'expo-router';

function SignOutButton() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  return <Button onPress={handleSignOut}>Sign Out</Button>;
}
```

## Password Reset

### Forgot Password

```typescript
import { useSignIn } from '@clerk/clerk-expo';

function ForgotPasswordForm() {
  const { signIn } = useSignIn();
  const [email, setEmail] = useState('');

  async function onSubmit() {
    try {
      await signIn.create({
        identifier: email,
      });
      await signIn.prepareFirstFactor({
        strategy: 'reset_password_email_code',
      });
      router.push('/(auth)/reset-password');
    } catch (err) {
      // Handle error
    }
  }

  return (
    <View>
      <Input value={email} onChangeText={setEmail} />
      <Button onPress={onSubmit}>Send Reset Code</Button>
    </View>
  );
}
```

### Reset Password

```typescript
import { useSignIn } from '@clerk/clerk-expo';

function ResetPasswordForm() {
  const { signIn, setActive } = useSignIn();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit() {
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err) {
      // Handle error
    }
  }

  return (
    <View>
      <Input value={code} onChangeText={setCode} />
      <Input value={password} onChangeText={setPassword} secureTextEntry />
      <Button onPress={onSubmit}>Reset Password</Button>
    </View>
  );
}
```

## Best Practices

### Always Check isLoaded

```typescript
const { isSignedIn, isLoaded } = useAuth();

if (!isLoaded) {
  return <ActivityIndicator />; // Show loading state
}

// Now safe to use isSignedIn
```

### Error Handling

```typescript
try {
  await signIn.create({ identifier: email, password });
} catch (err) {
  if (err instanceof Error) {
    setError(err.message);
  } else {
    console.error('Unknown error:', err);
    setError('Something went wrong');
  }
}
```

### User ID Matching

- Clerk `user.id` = Convex `identity.subject`
- Use this to match users between Clerk and Convex

## Conditional Rendering Based on Auth State

### Showing Login/Signup Buttons Only When Not Signed In

When displaying authentication buttons (login/signup), always check `isLoaded` and `isSignedIn`:

```typescript
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

function AuthButtons() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  // Don't render buttons until auth state is loaded
  if (!isLoaded) {
    return null; // or <ActivityIndicator />
  }

  // Only show buttons when user is NOT signed in
  if (isSignedIn) {
    return null; // User is already signed in
  }

  return (
    <View className="gap-4">
      <Button onPress={() => router.push('/(auth)/sign-in')}>
        <Text>Login</Text>
      </Button>
      <Button variant="outline" onPress={() => router.push('/(auth)/sign-up')}>
        <Text>Sign Up</Text>
      </Button>
    </View>
  );
}
```

### Important Notes

- **Always check `isLoaded`** before checking `isSignedIn` to avoid showing incorrect UI during auth initialization
- **Use `useRouter().push()`** instead of `<Link>` with `asChild` when wrapping Button components - `Link` with `asChild` may not work properly with custom Button components that use `Pressable`
- **Conditionally render** auth-related UI based on `isSignedIn` state
- **Route paths** should use the full route group path: `'/(auth)/sign-in'` not `'/sign-in'` when using `router.push()`

## Common Mistakes to Avoid

1. ❌ Not checking `isLoaded` before using auth state
2. ❌ Not handling sign-in/sign-up statuses properly
3. ❌ Not calling `setActive()` after successful authentication
4. ❌ Not handling errors properly
5. ❌ Not using `tokenCache` for secure token storage
6. ❌ Not checking authentication in protected components
7. ❌ Using `<Link asChild>` with Button components - use `useRouter().push()` instead
8. ❌ Showing login/signup buttons when user is already signed in
9. ❌ Not checking `isLoaded` before conditionally rendering auth UI

