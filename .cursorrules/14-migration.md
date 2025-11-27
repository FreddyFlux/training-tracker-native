# Migration Notes - Next.js → React Native

## Key Differences

### Navigation

- **No `useEffect` for navigation** - Use `useFocusEffect` from `expo-router` if needed
- **No `Link` href strings** - Use `href` prop with route paths
- **No `useSearchParams()`** - Use `useLocalSearchParams()` instead

### Styling

- **No CSS** - Use NativeWind classes only
- **No `style` prop** - Use `className` prop (NativeWind)
- **No CSS modules** - Use component-level styling

### Components

- **No HTML elements** - Use React Native components
  - `div` → `View`
  - `span` → `Text`
  - `button` → `Button` from `@/components/ui/button`
  - `input` → `Input` from `@/components/ui/input`

### Platform

- **No `window` object** - Use platform detection instead
- **No `localStorage`** - Use `expo-secure-store` or AsyncStorage
- **No `document`** - Not available in React Native

### Data Fetching

- **No `fetch` in components** - Use Convex hooks instead
- **No `getServerSideProps`** - Use Convex queries
- **No API routes** - Use Convex actions/mutations

### Routing

- **No `middleware.ts`** - Use Expo Router `Stack.Protected`
- **No `pages/` directory** - Use `app/` directory
- **No `_app.tsx`** - Use `app/_layout.tsx`

## Equivalent Patterns

| Next.js | React Native / Expo Router |
|---------|---------------------------|
| `useRouter()` | `useRouter()` from `expo-router` |
| `<Link href="/path">` | `<Link href="/path">` from `expo-router` |
| `useSearchParams()` | `useLocalSearchParams()` |
| API routes | Convex actions/mutations |
| Server Components | Convex queries |
| `middleware.ts` | `Stack.Protected` |
| `getServerSideProps` | Convex queries |
| `localStorage` | `expo-secure-store` |

## Common Migration Tasks

### 1. Convert HTML to React Native

```typescript
// Next.js
<div className="container">
  <span>Text</span>
  <button onClick={handleClick}>Click</button>
</div>

// React Native
<View className="container">
  <Text>Text</Text>
  <Button onPress={handleClick}>
    <Text>Click</Text>
  </Button>
</View>
```

### 2. Convert CSS to NativeWind

```typescript
// Next.js
<div style={{ padding: 16, backgroundColor: 'blue' }}>

// React Native
<View className="p-4 bg-blue-500">
```

### 3. Convert API Routes to Convex

```typescript
// Next.js API route
// pages/api/items.ts
export default async function handler(req, res) {
  const items = await getItems();
  res.json(items);
}

// Convex query
// convex/items.ts
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query('items').collect();
  },
});
```

### 4. Convert Server Components to Convex Queries

```typescript
// Next.js Server Component
async function ItemsList() {
  const items = await getItems();
  return <div>{items.map(...)}</div>;
}

// React Native with Convex
function ItemsList() {
  const items = useQuery(api.items.list);
  if (items === undefined) return <ActivityIndicator />;
  return <View>{items.map(...)}</View>;
}
```

## Migration Checklist

- [ ] Convert all HTML elements to React Native components
- [ ] Convert CSS to NativeWind classes
- [ ] Replace API routes with Convex actions/mutations
- [ ] Replace Server Components with Convex queries
- [ ] Update navigation to use Expo Router
- [ ] Replace `localStorage` with `expo-secure-store`
- [ ] Update environment variables (add `EXPO_PUBLIC_` prefix)
- [ ] Test on iOS and Android

