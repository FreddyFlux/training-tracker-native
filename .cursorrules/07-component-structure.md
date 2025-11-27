# Component Structure & Organization

## File Organization

```
components/
  ui/           # Reusable UI components (Button, Card, Input, etc.)
  feature/      # Feature-specific components
  layout/       # Layout components

app/
  (auth)/       # Auth-related screens
  (tabs)/       # Tab navigation screens
  _layout.tsx   # Root layout
```

## Component Pattern

### Basic Component

```typescript
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type MyComponentProps = {
  title: string;
  className?: string;
};

export function MyComponent({ title, className }: MyComponentProps) {
  return (
    <View className={cn('flex-1 p-4', className)}>
      <Text className="text-xl font-bold">{title}</Text>
    </View>
  );
}
```

### Component with State

```typescript
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

type CounterProps = {
  initialCount?: number;
};

export function Counter({ initialCount = 0 }: CounterProps) {
  const [count, setCount] = useState(initialCount);

  return (
    <View className="flex-row items-center gap-4">
      <Button onPress={() => setCount(count - 1)}>
        <Text>-</Text>
      </Button>
      <Text>{count}</Text>
      <Button onPress={() => setCount(count + 1)}>
        <Text>+</Text>
      </Button>
    </View>
  );
}
```

## Screen Component Pattern

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

## Form Component Pattern

```typescript
import { useState, useRef } from 'react';
import { View } from 'react-native';
import { TextInput } from 'react-native';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ email?: string; password?: string }>({});
  const passwordInputRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    // Validation and submission
  };

  return (
    <View className="gap-6">
      <View className="gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          onSubmitEditing={() => passwordInputRef.current?.focus()}
          returnKeyType="next"
        />
        {error.email && (
          <Text className="text-sm text-destructive">{error.email}</Text>
        )}
      </View>

      <View className="gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          ref={passwordInputRef}
          id="password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
        />
        {error.password && (
          <Text className="text-sm text-destructive">{error.password}</Text>
        )}
      </View>

      <Button onPress={handleSubmit}>
        <Text>Sign In</Text>
      </Button>
    </View>
  );
}
```

## List Component Pattern

```typescript
import { FlatList } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ActivityIndicator } from 'react-native';

type Item = {
  _id: string;
  name: string;
};

export function ItemsList() {
  const items = useQuery(api.items.list);

  if (items === undefined) {
    return <ActivityIndicator size="large" className="flex-1" />;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => <ItemCard item={item} />}
      contentContainerStyle={{ gap: 16, padding: 16 }}
    />
  );
}
```

## Component Composition

### Compound Components

```typescript
// Card.tsx
export function Card({ children, className }: CardProps) {
  return <View className={cn('rounded-lg border', className)}>{children}</View>;
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <View className="p-4 border-b">{children}</View>;
}

export function CardContent({ children }: { children: React.ReactNode }) {
  return <View className="p-4">{children}</View>;
}

// Usage
<Card>
  <CardHeader>
    <Text>Title</Text>
  </CardHeader>
  <CardContent>
    <Text>Content</Text>
  </CardContent>
</Card>
```

## Custom Hooks

### Extract Reusable Logic

```typescript
// hooks/use-form.ts
import { useState } from 'react';

type UseFormReturn<T> = {
  values: T;
  setValue: <K extends keyof T>(key: K, value: T[K]) => void;
  errors: Partial<Record<keyof T, string>>;
  setError: <K extends keyof T>(key: K, error: string) => void;
  reset: () => void;
};

export function useForm<T extends Record<string, any>>(
  initialValues: T
): UseFormReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const setValue = <K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear error when value changes
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const setError = <K extends keyof T>(key: K, error: string) => {
    setErrors((prev) => ({ ...prev, [key]: error }));
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
  };

  return { values, setValue, errors, setError, reset };
}
```

## Component Organization Principles

### Single Responsibility

- Each component should have one clear purpose
- Extract sub-components when a component becomes too complex
- Keep components focused and reusable

### Composition over Configuration

- Prefer composition (children, slots) over many props
- Use compound components for related UI elements
- Keep components flexible and composable

### File Naming

- Components: PascalCase (`MyComponent.tsx`)
- Hooks: camelCase with `use` prefix (`use-form.ts`)
- Utilities: camelCase (`format-date.ts`)
- Types: PascalCase (`User.ts`)

## Best Practices

1. **Keep components small** - Extract when they exceed ~200 lines
2. **Use TypeScript** - Type all props and state
3. **Extract hooks** - Move reusable logic to custom hooks
4. **Compose components** - Build complex UIs from simple components
5. **Use consistent patterns** - Follow established patterns across codebase
6. **Document complex logic** - Add comments for non-obvious code

## Common Mistakes to Avoid

1. ❌ Creating components that are too large
2. ❌ Not extracting reusable logic into hooks
3. ❌ Not using TypeScript for props
4. ❌ Mixing concerns (UI + business logic)
5. ❌ Not composing components properly
6. ❌ Inconsistent naming conventions

