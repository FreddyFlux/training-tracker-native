# TypeScript Patterns

## Type Safety Principles

- **ALWAYS** use TypeScript - no `any` types
- Define proper types for all props, state, and function parameters
- Use `type` for object shapes, `interface` for extensible contracts
- Use `as const` for readonly values
- Use `NonNullable<T>` to exclude null/undefined

## Component Props

```typescript
type MyComponentProps = {
  title: string;
  onPress?: () => void;
  variant?: 'default' | 'outline';
  className?: string;
};

export function MyComponent({ 
  title, 
  onPress, 
  variant = 'default',
  className 
}: MyComponentProps) {
  return (
    <View className={className}>
      <Text>{title}</Text>
    </View>
  );
}
```

## Search Params

```typescript
import { useLocalSearchParams } from 'expo-router';

type SearchParams = {
  id?: string;
  tab?: 'overview' | 'details';
};

export default function DetailsScreen() {
  const { id, tab } = useLocalSearchParams<SearchParams>();
  
  // id and tab are typed
}
```

## Form State

```typescript
type FormState = {
  email: string;
  password: string;
  errors: {
    email?: string;
    password?: string;
  };
};

function SignInForm() {
  const [formState, setFormState] = useState<FormState>({
    email: '',
    password: '',
    errors: {},
  });
}
```

## React Native Types

### Refs

```typescript
import { useRef } from 'react';
import { TextInput } from 'react-native';

const inputRef = useRef<TextInput>(null);

<Input ref={inputRef} />
```

### State

```typescript
const [value, setValue] = useState<string>('');
const [items, setItems] = useState<Item[]>([]);
const [isLoading, setIsLoading] = useState<boolean>(false);
```

### Event Handlers

```typescript
type PressEvent = {
  nativeEvent: {
    timestamp: number;
  };
};

const handlePress = (event: PressEvent) => {
  // Handle press
};
```

## Convex Types

### Query/Mutation Types

```typescript
import { api } from '@/convex/_generated/api';

// Types are inferred from Convex functions
const data = useQuery(api.items.list, { userId: '123' });
// data is typed based on the query return type
```

### Function Args

```typescript
// convex/items.ts
export const createItem = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // args is typed: { name: string; description?: string }
  },
});
```

## Utility Types

### Readonly Values

```typescript
const SCREEN_OPTIONS = {
  headerShown: false,
  title: 'My Screen',
} as const;

// SCREEN_OPTIONS is readonly
```

### NonNullable

```typescript
type MaybeString = string | null | undefined;

const value: NonNullable<MaybeString> = 'hello'; // Excludes null/undefined
```

### Partial

```typescript
type User = {
  name: string;
  email: string;
  age: number;
};

type PartialUser = Partial<User>; // All fields optional
```

### Pick / Omit

```typescript
type User = {
  name: string;
  email: string;
  age: number;
};

type UserName = Pick<User, 'name'>; // { name: string }
type UserWithoutAge = Omit<User, 'age'>; // { name: string; email: string }
```

## Type Guards

```typescript
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

try {
  await someOperation();
} catch (error) {
  if (isError(error)) {
    console.error(error.message);
  }
}
```

## Generic Types

```typescript
type ApiResponse<T> = {
  data: T;
  error?: string;
};

type UserResponse = ApiResponse<User>;
type ItemResponse = ApiResponse<Item[]>;
```

## Common Patterns

### Optional Props with Defaults

```typescript
type ButtonProps = {
  title: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
};

function Button({ 
  title, 
  variant = 'primary',
  size = 'md' 
}: ButtonProps) {
  // Implementation
}
```

### Discriminated Unions

```typescript
type LoadingState = 
  | { status: 'loading' }
  | { status: 'success'; data: Item[] }
  | { status: 'error'; error: string };

function Component() {
  const [state, setState] = useState<LoadingState>({ status: 'loading' });

  if (state.status === 'success') {
    // TypeScript knows state.data exists
    return <View>{state.data.map(...)}</View>;
  }
}
```

### Function Overloads

```typescript
function format(value: string): string;
function format(value: number): string;
function format(value: string | number): string {
  return String(value);
}
```

## Best Practices

1. **Never use `any`** - Use `unknown` if type is truly unknown
2. **Use type inference** - Let TypeScript infer types when possible
3. **Define types close to usage** - Keep types near where they're used
4. **Use `as const`** - For readonly values and literal types
5. **Use type guards** - For runtime type checking
6. **Document complex types** - Add JSDoc comments for complex types

## Common Mistakes to Avoid

1. ❌ Using `any` type
2. ❌ Not typing component props
3. ❌ Not typing function parameters
4. ❌ Not using `as const` for constants
5. ❌ Not handling null/undefined properly
6. ❌ Not using type guards for error handling

