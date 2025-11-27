# Common Patterns & Snippets

## Safe Area Handling

```typescript
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();

<View style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
  {/* Content */}
</View>
```

## Loading State

```typescript
const data = useQuery(api.myModule.myQuery);

if (data === undefined) {
  return <ActivityIndicator size="large" className="flex-1" />;
}
```

## Form with Validation

```typescript
const [email, setEmail] = useState('');
const [error, setError] = useState('');

<View className="gap-1.5">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    value={email}
    onChangeText={setEmail}
    keyboardType="email-address"
  />
  {error && <Text className="text-sm text-destructive">{error}</Text>}
</View>
```

## Navigation with Params

```typescript
import { router, useLocalSearchParams } from 'expo-router';

// Reading params
const { id } = useLocalSearchParams<{ id: string }>();

// Navigating with params
router.push({
  pathname: '/details',
  params: { id: '123' },
});
```

## Conditional Rendering

```typescript
{isLoading && <ActivityIndicator />}
{error && <Text className="text-destructive">{error}</Text>}
{items.length > 0 && <ItemsList items={items} />}
```

## List Rendering

```typescript
<FlatList
  data={items}
  keyExtractor={(item) => item._id}
  renderItem={({ item }) => <ItemCard item={item} />}
  ListEmptyComponent={<Text>No items found</Text>}
/>
```

