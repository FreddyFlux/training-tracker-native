# State Management

## Local State

### useState

Use `useState` for component-local state:

```typescript
import { useState } from 'react';

function MyComponent() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  return (
    <View>
      <Text>{count}</Text>
      <Button onPress={() => setCount(count + 1)}>Increment</Button>
    </View>
  );
}
```

### useReducer

Use `useReducer` for complex state logic:

```typescript
import { useReducer } from 'react';

type State = {
  count: number;
  step: number;
};

type Action =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'reset' }
  | { type: 'setStep'; step: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment':
      return { ...state, count: state.count + state.step };
    case 'decrement':
      return { ...state, count: state.count - state.step };
    case 'reset':
      return { ...state, count: 0 };
    case 'setStep':
      return { ...state, step: action.step };
    default:
      return state;
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, { count: 0, step: 1 });

  return (
    <View>
      <Text>{state.count}</Text>
      <Button onPress={() => dispatch({ type: 'increment' })}>
        Increment
      </Button>
    </View>
  );
}
```

### useRef

Use `useRef` for mutable values that don't trigger re-renders:

```typescript
import { useRef } from 'react';
import { TextInput } from 'react-native';

function MyForm() {
  const inputRef = useRef<TextInput>(null);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  return (
    <View>
      <Input ref={inputRef} />
      <Button onPress={focusInput}>Focus Input</Button>
    </View>
  );
}
```

## Server State (Convex)

### useQuery - Read Data

```typescript
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

function ItemsList() {
  const items = useQuery(api.items.list, { userId: '123' });

  // Always handle undefined (loading state)
  if (items === undefined) {
    return <ActivityIndicator />;
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

### useMutation - Write Data

```typescript
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

function CreateItemForm() {
  const createItem = useMutation(api.items.create);
  const [name, setName] = useState('');

  const handleSubmit = async () => {
    try {
      await createItem({ name });
      setName(''); // Clear form
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <View>
      <Input value={name} onChangeText={setName} />
      <Button onPress={handleSubmit}>Create</Button>
    </View>
  );
}
```

### useAction - External Operations

```typescript
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';

function SendEmailButton() {
  const sendEmail = useAction(api.email.send);

  const handleSend = async () => {
    try {
      await sendEmail({ to: 'user@example.com', subject: 'Hello' });
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return <Button onPress={handleSend}>Send Email</Button>;
}
```

### Convex State Management Principles

- **NEVER** use external state management (Redux, Zustand) for server state
- Convex handles caching, refetching, and reactivity automatically
- Use Convex hooks (`useQuery`, `useMutation`) for all server state
- Local state is fine for UI-only state (modals, form inputs, etc.)

## Form State

### Controlled Components

```typescript
import { useState } from 'react';

function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const handleSubmit = () => {
    // Validate
    const newErrors: typeof errors = {};
    if (!email) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Submit
    // ...
  };

  return (
    <View>
      <Input
        value={email}
        onChangeText={setEmail}
        // Clear error when user types
        onFocus={() => setErrors({ ...errors, email: undefined })}
      />
      {errors.email && <Text className="text-destructive">{errors.email}</Text>}
      {/* ... */}
    </View>
  );
}
```

### Custom Form Hook

```typescript
// hooks/use-form.ts
export function useForm<T extends Record<string, any>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const setValue = <K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear error when value changes
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
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

## Optimistic Updates

```typescript
import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

function LikeButton({ itemId }: { itemId: string }) {
  const item = useQuery(api.items.get, { id: itemId });
  const toggleLike = useMutation(api.items.toggleLike);
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);

  const handleLike = async () => {
    const currentLiked = optimisticLiked ?? item?.liked ?? false;
    const newLiked = !currentLiked;

    // Optimistically update UI
    setOptimisticLiked(newLiked);

    try {
      await toggleLike({ id: itemId });
      // Reset optimistic state - query will update automatically
      setOptimisticLiked(null);
    } catch (error) {
      // Revert on error
      setOptimisticLiked(null);
      console.error('Error toggling like:', error);
    }
  };

  const isLiked = optimisticLiked ?? item?.liked ?? false;

  return (
    <Button onPress={handleLike}>
      <Text>{isLiked ? 'Unlike' : 'Like'}</Text>
    </Button>
  );
}
```

## State Management Best Practices

### When to Use Local State

- UI-only state (modals, dropdowns, form inputs)
- Component-specific state that doesn't need to be shared
- Temporary state (loading indicators, error messages)

### When to Use Server State (Convex)

- Data that comes from the backend
- Data that needs to be shared across components
- Data that needs to persist
- Data that needs real-time updates

### State Organization

- Keep state as close to where it's used as possible
- Lift state up only when necessary
- Use Convex for shared/persisted state
- Use local state for UI-only state

## Common Mistakes to Avoid

1. ❌ Using Redux/Zustand for server state (use Convex instead)
2. ❌ Not handling loading states from queries
3. ❌ Not handling errors properly
4. ❌ Storing server data in local state unnecessarily
5. ❌ Not using optimistic updates for better UX
6. ❌ Not clearing form state after submission

