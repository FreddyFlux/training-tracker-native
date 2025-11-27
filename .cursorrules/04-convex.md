# Convex Integration

## Setup

- Convex functions live in `convex/` directory
- Use `convex/react` hooks in components: `useQuery`, `useMutation`, `useAction`
- Use `convex/react-clerk` for Clerk integration: `ConvexProviderWithClerk`
- Environment variable: `EXPO_PUBLIC_CONVEX_URL`

## Provider Setup

```typescript
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

<ClerkProvider publishableKey={publishableKey}>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    {children}
  </ConvexProviderWithClerk>
</ClerkProvider>
```

## Querying Data

### Basic Query

```typescript
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

function MyComponent() {
  const data = useQuery(api.myModule.myQuery, { arg: 'value' });

  // Always handle undefined (loading state)
  if (data === undefined) {
    return <ActivityIndicator size="large" className="flex-1" />;
  }

  return <View>{/* Render data */}</View>;
}
```

### Query with Parameters

```typescript
const items = useQuery(api.items.list, { 
  userId: currentUserId,
  limit: 10 
});
```

### Query Best Practices

- Always handle `undefined` from `useQuery` (loading state)
- Show `ActivityIndicator` or skeleton screens during loading
- Queries are reactive - they automatically update when data changes
- Queries can be called frequently - they're optimized for this

## Mutations

### Basic Mutation

```typescript
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

function MyComponent() {
  const createItem = useMutation(api.myModule.createItem);

  const handleCreate = async () => {
    try {
      await createItem({ name: 'New Item' });
      // Success - query will automatically refetch
    } catch (error) {
      console.error('Error:', error);
      // Handle error
    }
  };

  return <Button onPress={handleCreate}>Create</Button>;
}
```

### Mutation with Optimistic Updates

```typescript
const updateItem = useMutation(api.items.update);

const handleUpdate = async () => {
  // Optimistically update UI
  setLocalState(newValue);
  
  try {
    await updateItem({ id, value: newValue });
  } catch (error) {
    // Revert on error
    setLocalState(oldValue);
  }
};
```

### Mutation Best Practices

- Mutations are NOT reactive - they don't automatically refetch queries
- Use try/catch for error handling
- Consider optimistic updates for better UX
- Mutations should be called in response to user actions

## Actions (for External APIs)

```typescript
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';

function MyComponent() {
  const sendEmail = useAction(api.myModule.sendEmail);

  const handleSend = async () => {
    try {
      await sendEmail({ to: 'user@example.com', subject: 'Hello' });
    } catch (error) {
      console.error('Error sending email:', error);
    }
  };
}
```

### When to Use Actions

- External API calls
- File uploads
- Non-reactive operations
- Operations that don't need to be reactive

## Server-Side Functions

### Function Types

- **Queries**: Read-only, reactive, can be called frequently
- **Mutations**: Write data, not reactive, use for updates
- **Actions**: External API calls, file uploads, non-reactive operations

### Query Function

```typescript
// convex/myModule.ts
import { query } from 'convex/server';
import { v } from 'convex/values';
import { getUserId } from './auth';

export const myQuery = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getUserId(ctx);
    
    // Only return data for current user
    return await ctx.db
      .query('myTable')
      .withIndex('by_user', (q) => q.eq('userId', currentUserId))
      .collect();
  },
});
```

### Mutation Function

```typescript
// convex/myModule.ts
import { mutation } from 'convex/server';
import { v } from 'convex/values';
import { getUserId } from './auth';

export const createItem = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    
    return await ctx.db.insert('myTable', {
      userId,
      name: args.name,
      description: args.description,
      createdAt: Date.now(),
    });
  },
});
```

### Action Function

```typescript
// convex/myModule.ts
import { action } from 'convex/server';
import { v } from 'convex/values';

export const sendEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    // Call external API
    const response = await fetch('https://api.email-service.com/send', {
      method: 'POST',
      body: JSON.stringify(args),
    });
    
    return await response.json();
  },
});
```

## Authentication in Convex

### Auth Helper Functions

```typescript
// convex/auth.ts
import { Auth } from 'convex/server';

/**
 * Gets the authenticated user's ID
 * @throws Error if not authenticated
 */
export async function getUserId(ctx: { auth: Auth }): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Not authenticated');
  }
  return identity.subject; // Clerk user ID
}

/**
 * Requires authentication and returns the user identity
 * @throws Error if not authenticated
 */
export async function requireAuth(ctx: { auth: Auth }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Not authenticated');
  }
  return identity;
}

/**
 * Gets the authenticated user's ID or returns null
 * Use this for queries that should return empty results for unauthenticated users
 */
export async function getUserIdOrNull(ctx: { auth: Auth }): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  return identity.subject;
}
```

### Using Auth in Functions

```typescript
import { getUserId } from './auth';

export const myQuery = query({
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    // Use userId to filter data
    return await ctx.db
      .query('myTable')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
  },
});
```

## Schema Definition

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  myTable: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_and_name', ['userId', 'name'])
    .searchIndex('search_name', {
      searchField: 'name',
      filterFields: ['userId'],
    }),
});
```

### Schema Best Practices

- Always validate inputs using `v.*` validators
- Use indexes for efficient queries
- Use `searchIndex` for full-text search
- Denormalize data when needed for performance
- Use `v.optional()` for nullable fields
- Use `v.union()` for multiple types
- Add `createdAt` and `updatedAt` timestamps

## Best Practices

### Data Fetching

- Always handle loading states (`undefined`) from queries
- Use error boundaries for error handling
- Prefer queries over actions when possible (reactive)
- Use indexes for efficient queries

### Performance

- Denormalize data when needed for performance
- Use `searchIndex` for full-text search
- Consider pagination for large datasets
- Use optimistic updates for better UX

### Security

- Always validate inputs using `v.*` validators
- Use `getUserId()` to ensure user authentication
- Filter data by `userId` to ensure user isolation
- Never trust client-side data

### Error Handling

```typescript
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
```

## Common Patterns

### Loading State Pattern

```typescript
const data = useQuery(api.myModule.myQuery);

if (data === undefined) {
  return <ActivityIndicator size="large" className="flex-1" />;
}

if (data.length === 0) {
  return <Text>No items found</Text>;
}

return (
  <FlatList
    data={data}
    keyExtractor={(item) => item._id}
    renderItem={({ item }) => <ItemComponent item={item} />}
  />
);
```

### Create Pattern

```typescript
const createItem = useMutation(api.items.create);
const [isCreating, setIsCreating] = useState(false);

const handleCreate = async () => {
  setIsCreating(true);
  try {
    await createItem({ name: 'New Item' });
    // Success - query will refetch automatically
  } catch (error) {
    console.error('Error:', error);
  } finally {
    setIsCreating(false);
  }
};
```

## Common Mistakes to Avoid

1. ❌ Not handling `undefined` from queries (loading state)
2. ❌ Not validating inputs in mutations
3. ❌ Not filtering by `userId` for user-specific data
4. ❌ Using actions when queries would work
5. ❌ Not using indexes for queries
6. ❌ Not handling errors properly
7. ❌ Trusting client-side data without validation

