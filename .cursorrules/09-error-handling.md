# Error Handling

## Error Boundaries

### Route-Level Error Boundary

Expo Router provides an `ErrorBoundary` automatically:

```typescript
// app/_layout.tsx
export {
  ErrorBoundary,
} from 'expo-router';
```

### Custom Error Boundary

```typescript
import { ErrorBoundary } from 'expo-router';
import { View, Text } from 'react-native';

export function CustomErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, retry }) => (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-xl font-bold text-destructive">
            Something went wrong
          </Text>
          <Text className="text-muted-foreground">{error.message}</Text>
          <Button onPress={retry}>
            <Text>Try Again</Text>
          </Button>
        </View>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
```

## Async Error Handling

### Try-Catch Pattern

```typescript
async function handleSubmit() {
  try {
    await mutation({ data });
    // Success
  } catch (error) {
    if (error instanceof Error) {
      setError(error.message);
    } else {
      console.error('Unknown error:', error);
      setError('Something went wrong');
    }
  }
}
```

### Convex Mutation Error Handling

```typescript
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

function CreateItemForm() {
  const createItem = useMutation(api.items.create);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    try {
      await createItem({ name: 'New Item' });
      // Success
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to create item');
      }
    }
  };

  return (
    <View>
      {error && (
        <Text className="text-sm text-destructive">{error}</Text>
      )}
      <Button onPress={handleSubmit}>Create</Button>
    </View>
  );
}
```

### Clerk Error Handling

```typescript
import { useSignIn } from '@clerk/clerk-expo';

function SignInForm() {
  const { signIn, setActive } = useSignIn();
  const [error, setError] = useState<{ email?: string; password?: string }>({});

  async function onSubmit() {
    try {
      const signInAttempt = await signIn.create({
        identifier: email,
        password,
      });

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId });
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

  return (
    <View>
      {error.email && (
        <Text className="text-sm text-destructive">{error.email}</Text>
      )}
      {error.password && (
        <Text className="text-sm text-destructive">{error.password}</Text>
      )}
    </View>
  );
}
```

## Loading States

### Query Loading State

```typescript
import { useQuery } from 'convex/react';
import { ActivityIndicator } from 'react-native';

function ItemsList() {
  const items = useQuery(api.items.list);

  // Always handle undefined (loading state)
  if (items === undefined) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => <ItemCard item={item} />}
    />
  );
}
```

### Mutation Loading State

```typescript
import { useState } from 'react';
import { useMutation } from 'convex/react';

function CreateItemForm() {
  const createItem = useMutation(api.items.create);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      await createItem({ name: 'New Item' });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onPress={handleSubmit} disabled={isLoading}>
      {isLoading ? (
        <ActivityIndicator />
      ) : (
        <Text>Create</Text>
      )}
    </Button>
  );
}
```

## Error Display Patterns

### Inline Error Messages

```typescript
function FormField({ error, ...props }: FormFieldProps) {
  return (
    <View className="gap-1.5">
      <Input {...props} />
      {error && (
        <Text className="text-sm text-destructive">{error}</Text>
      )}
    </View>
  );
}
```

### Toast/Alert Errors

```typescript
import { Alert } from 'react-native';

function handleError(error: Error) {
  Alert.alert('Error', error.message, [
    { text: 'OK' },
  ]);
}
```

### Error Banner

```typescript
function ErrorBanner({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  if (!error) return null;

  return (
    <View className="bg-destructive/10 border border-destructive p-4 rounded-lg">
      <View className="flex-row items-center justify-between">
        <Text className="text-destructive flex-1">{error}</Text>
        <Button onPress={onDismiss} variant="ghost" size="sm">
          <Text>×</Text>
        </Button>
      </View>
    </View>
  );
}
```

## Error Recovery

### Retry Pattern

```typescript
function RetryableOperation() {
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleOperation = async () => {
    setError(null);
    try {
      await performOperation();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    }
  };

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    handleOperation();
  };

  return (
    <View>
      {error && (
        <View>
          <Text className="text-destructive">{error.message}</Text>
          <Button onPress={handleRetry}>
            <Text>Retry</Text>
          </Button>
        </View>
      )}
    </View>
  );
}
```

### Fallback UI

```typescript
function ItemsList() {
  const items = useQuery(api.items.list);
  const [error, setError] = useState<Error | null>(null);

  if (items === undefined) {
    return <ActivityIndicator />;
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-xl font-bold text-destructive">
          Failed to load items
        </Text>
        <Text className="text-muted-foreground">{error.message}</Text>
        <Button onPress={() => setError(null)}>
          <Text>Try Again</Text>
        </Button>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-muted-foreground">No items found</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => <ItemCard item={item} />}
    />
  );
}
```

## Best Practices

### Error Handling Checklist

1. ✅ Always handle `undefined` from queries (loading state)
2. ✅ Use try-catch for async operations
3. ✅ Check `error instanceof Error` before accessing properties
4. ✅ Show user-friendly error messages
5. ✅ Provide retry mechanisms when appropriate
6. ✅ Use error boundaries for unexpected errors
7. ✅ Log errors for debugging (but don't expose to users)
8. ✅ Clear errors when user takes action

### Error Message Guidelines

- **User-friendly**: Don't expose technical details
- **Actionable**: Tell user what they can do
- **Contextual**: Show error near where it occurred
- **Dismissible**: Allow user to dismiss errors

## Common Mistakes to Avoid

1. ❌ Not handling loading states (`undefined` from queries)
2. ❌ Not using try-catch for async operations
3. ❌ Exposing technical error messages to users
4. ❌ Not providing retry mechanisms
5. ❌ Not clearing errors when user takes action
6. ❌ Not using error boundaries for unexpected errors
7. ❌ Not checking `error instanceof Error` before accessing properties

