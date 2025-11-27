# Performance Optimization

## List Rendering

### FlatList Best Practices

**ALWAYS** use `FlatList` for long lists, never `ScrollView` with `map()`:

```typescript
<FlatList
  data={items}
  keyExtractor={(item) => item._id}
  renderItem={({ item }) => <ItemCard item={item} />}
  // Performance optimizations
  removeClippedSubviews={true}
  initialNumToRender={10}
  maxToRenderPerBatch={10}
  windowSize={10}
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

### Key Extractor

Always provide a stable `keyExtractor`:

```typescript
// Good
<FlatList
  keyExtractor={(item) => item._id}
/>

// Bad - using index
<FlatList
  keyExtractor={(item, index) => index.toString()}
/>
```

### getItemLayout

Use `getItemLayout` when item heights are known:

```typescript
const ITEM_HEIGHT = 80;

<FlatList
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

## Memoization

### React.memo

Use `React.memo()` for expensive components:

```typescript
import { memo } from 'react';

const ItemCard = memo(function ItemCard({ item }: { item: Item }) {
  return (
    <View>
      <Text>{item.name}</Text>
    </View>
  );
});
```

### useMemo

Use `useMemo()` for expensive calculations:

```typescript
import { useMemo } from 'react';

function ExpensiveComponent({ items }: { items: Item[] }) {
  const sortedItems = useMemo(() => {
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  return (
    <FlatList
      data={sortedItems}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => <ItemCard item={item} />}
    />
  );
}
```

### useCallback

Use `useCallback()` for stable function references:

```typescript
import { useCallback } from 'react';

function ParentComponent() {
  const handleItemPress = useCallback((itemId: string) => {
    router.push(`/items/${itemId}`);
  }, []);

  return (
    <FlatList
      data={items}
      renderItem={({ item }) => (
        <ItemCard item={item} onPress={() => handleItemPress(item._id)} />
      )}
    />
  );
}
```

### When NOT to Memoize

- Don't over-optimize - measure first
- Don't memoize simple components
- Don't memoize if props change frequently
- Don't memoize if calculation is cheap

## Image Optimization

### expo-image

Use `expo-image` for better performance:

```typescript
import { Image } from 'expo-image';

<Image
  source={{ uri: imageUrl }}
  style={{ width: 200, height: 200 }}
  contentFit="cover"
  transition={200}
/>
```

### Image Sizing

Use appropriate image sizes:

```typescript
// Use different sizes for different screens
const imageSize = Platform.select({
  ios: 200,
  android: 200,
  default: 300, // web
});

<Image
  source={{ uri: imageUrl }}
  style={{ width: imageSize, height: imageSize }}
/>
```

### Lazy Loading

Lazy load images in lists:

```typescript
<FlatList
  data={items}
  renderItem={({ item }) => (
    <Image
      source={{ uri: item.imageUrl }}
      style={{ width: 100, height: 100 }}
      // Only load when visible
      placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }}
    />
  )}
/>
```

## Convex Query Optimization

### Index Usage

Always use indexes for queries:

```typescript
// Good - uses index
export const getItems = query({
  handler: async (ctx) => {
    return await ctx.db
      .query('items')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
  },
});

// Bad - full table scan
export const getItems = query({
  handler: async (ctx) => {
    return await ctx.db
      .query('items')
      .collect()
      .then((items) => items.filter((item) => item.userId === userId));
  },
});
```

### Pagination

Use pagination for large datasets:

```typescript
export const getItems = query({
  args: {
    limit: v.number(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query('items')
      .withIndex('by_user')
      .order('desc')
      .take(args.limit);

    return {
      items,
      cursor: items[items.length - 1]?._id,
    };
  },
});
```

### Denormalization

Denormalize data for performance:

```typescript
// Denormalize userId in items table for faster queries
export default defineSchema({
  items: defineTable({
    userId: v.string(), // Denormalized
    name: v.string(),
    // ...
  }).index('by_user', ['userId']),
});
```

## Render Optimization

### Avoid Unnecessary Renders

```typescript
// Bad - creates new object on every render
<ItemCard item={{ name: 'Item' }} />

// Good - stable reference
const item = { name: 'Item' };
<ItemCard item={item} />
```

### Conditional Rendering

```typescript
// Good - early return
function Component({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return <EmptyState />;
  }

  return <ItemsList items={items} />;
}
```

## Performance Monitoring

### React DevTools Profiler

Use React DevTools Profiler to identify performance issues:

1. Record a session
2. Identify slow components
3. Optimize based on findings

### Performance Best Practices Checklist

- [ ] Using `FlatList` for long lists
- [ ] Providing `keyExtractor` for lists
- [ ] Using `getItemLayout` when possible
- [ ] Memoizing expensive components
- [ ] Using indexes for Convex queries
- [ ] Optimizing images
- [ ] Avoiding unnecessary re-renders
- [ ] Using pagination for large datasets

## Common Mistakes to Avoid

1. ❌ Using `ScrollView` with `map()` for long lists
2. ❌ Not providing `keyExtractor` for `FlatList`
3. ❌ Not using indexes for Convex queries
4. ❌ Over-memoizing components
5. ❌ Loading full datasets without pagination
6. ❌ Not optimizing images
7. ❌ Creating new objects/functions in render

