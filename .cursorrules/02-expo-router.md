# Expo Router Patterns

## File-Based Routing

Routes are defined by file structure in `app/` directory:

```
app/
  index.tsx              # / (root route)
  (auth)/
    sign-in.tsx          # /sign-in
    sign-up/
      index.tsx          # /sign-up
      verify-email.tsx   # /sign-up/verify-email
  _layout.tsx            # Layout wrapper
  +not-found.tsx         # 404 page
  +html.tsx              # Custom HTML (web only)
```

### Route Groups
- Use `(group)` folders for route groups that don't affect URL structure
- Example: `(auth)/sign-in.tsx` → `/sign-in` (not `/auth/sign-in`)

### Layout Files
- Use `_layout.tsx` files for nested layouts
- Layouts wrap child routes and can define navigation structure

### Special Files
- `+not-found.tsx` - 404 page
- `+html.tsx` - Custom HTML document (web only)

## Navigation Hooks

**ALWAYS** use `expo-router` navigation hooks:

```typescript
import { useRouter, usePathname, useSegments, useLocalSearchParams } from 'expo-router';

// Navigation
const router = useRouter();
router.push('/path');
router.replace('/path');
router.back();

// Current route info
const pathname = usePathname(); // Current pathname
const segments = useSegments(); // Current route segments

// Query parameters
const { id, tab } = useLocalSearchParams<{ id?: string; tab?: string }>();
```

### Important Notes
- **NEVER** use `@react-navigation/native` directly - Expo Router handles this
- Use `useLocalSearchParams()` to read query parameters, not `useSearchParams()`
- Use `router.push()` for navigation, `router.replace()` for replacing history

## Link Component

Use `<Link>` component for declarative navigation:

```typescript
import { Link } from 'expo-router';

<Link href="/sign-in">Sign In</Link>

// With params
<Link href={{ pathname: '/details', params: { id: '123' } }}>
  View Details
</Link>
```

### Link with Button Components

**IMPORTANT**: When using `Link` with custom Button components (like `@/components/ui/button`), `Link` with `asChild` may not work properly because the Button component uses `Pressable` internally.

**Prefer using `useRouter()` instead:**

```typescript
// ❌ Avoid - may not be clickable
<Link href="/sign-in" asChild>
  <Button>Sign In</Button>
</Link>

// ✅ Preferred - always works
import { useRouter } from 'expo-router';

const router = useRouter();
<Button onPress={() => router.push('/(auth)/sign-in')}>
  <Text>Sign In</Text>
</Button>
```

**When to use each:**
- Use `<Link>` for simple text links or when wrapping native components
- Use `useRouter().push()` with Button components for reliable click handling

## Route Protection

Use `Stack.Protected` with `guard` prop for protected routes:

```typescript
// In app/_layout.tsx
import { Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

function Routes() {
  const { isSignedIn } = useAuth();

  return (
    <Stack>
      {/* Screens only shown when the user IS signed in */}
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="dashboard" />
      </Stack.Protected>

      {/* Screens only shown when the user is NOT signed in */}
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)/sign-in" />
        <Stack.Screen name="(auth)/sign-up" />
      </Stack.Protected>

      {/* Screens accessible to everyone */}
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
```

## Screen Options

Define screen options as constants outside component:

```typescript
import { Stack } from 'expo-router';

// Define options as constants
const SCREEN_OPTIONS = {
  headerShown: false,
  title: 'My Screen',
} as const;

export default function MyScreen() {
  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />
      {/* Screen content */}
    </>
  );
}
```

### Common Screen Options

- `headerShown: false` - Hide header
- `headerTransparent: true` - Transparent header
- `presentation: 'modal'` - Modal presentation (iOS)
- `gestureEnabled: false` - Disable swipe back
- `title: 'Screen Title'` - Set header title

## Navigation Patterns

### Navigating with Params

```typescript
import { router } from 'expo-router';

// Push with params
router.push({
  pathname: '/details',
  params: { id: '123', tab: 'overview' },
});

// Reading params
import { useLocalSearchParams } from 'expo-router';

export default function DetailsScreen() {
  const { id, tab } = useLocalSearchParams<{ 
    id: string; 
    tab?: string 
  }>();
  
  // Use params
}
```

### Programmatic Navigation

```typescript
// Navigate forward
router.push('/next-screen');

// Replace current screen
router.replace('/new-screen');

// Go back
router.back();

// Navigate with replace (no back button)
router.replace('/(tabs)/home');
```

## Focus Effects

Use `useFocusEffect` for side effects when screen comes into focus:

```typescript
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

export default function MyScreen() {
  useFocusEffect(
    useCallback(() => {
      // Screen is focused
      // Fetch data, update state, etc.
      
      return () => {
        // Cleanup when screen loses focus
      };
    }, [])
  );
}
```

## Common Patterns

### Screen Component Pattern

```typescript
import { View, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ title: 'My Screen' }} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom }}
      >
        {/* Content */}
      </ScrollView>
    </>
  );
}
```

## Common Mistakes to Avoid

1. ❌ Using `@react-navigation/native` directly
2. ❌ Using `useSearchParams()` instead of `useLocalSearchParams()`
3. ❌ Not using `Stack.Protected` for route protection
4. ❌ Defining screen options inside component (use constants)
5. ❌ Not handling loading states before navigation

