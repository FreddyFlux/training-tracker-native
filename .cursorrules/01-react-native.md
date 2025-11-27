# React Native Best Practices

## Core Principles

- **ALWAYS** use React Native components (`View`, `Text`, `ScrollView`, `Pressable`, etc.) instead of HTML elements
- **NEVER** use `div`, `span`, `button`, `input` - use React Native equivalents
- Always test on both iOS and Android - platform differences matter

## Component Usage

### Interactive Elements

- Use `Pressable` for buttons/interactive elements (not `TouchableOpacity` or `TouchableHighlight`)
- `Pressable` provides better accessibility and cross-platform consistency

### Layout Components

- Use `View` for containers (equivalent to `div`)
- Use `ScrollView` or `FlatList` for scrollable content - never assume content fits on screen
- Always handle safe areas using `SafeAreaProvider` and `useSafeAreaInsets` from `react-native-safe-area-context`

### Text Components

- Use `Text` from React Native (not `p`, `span`, `h1`, etc.)
- Text must be wrapped in `Text` component - cannot be direct children of `View`

### Images

- Prefer `Image` from `react-native` or `expo-image` for images
- Use `expo-image` for better performance and features

### Loading States

- Use `ActivityIndicator` for loading states, not custom spinners
- Show loading indicators during async operations

### Keyboard Handling

- Handle keyboard with `KeyboardAvoidingView` when needed
- Use `KeyboardAvoidingView` with `behavior` prop (iOS: `padding`, Android: `height`)

## Safe Area Handling

```typescript
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// In root layout
<SafeAreaProvider>
  {children}
</SafeAreaProvider>

// In components
const insets = useSafeAreaInsets();

<View style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
  {/* Content */}
</View>
```

## Scrollable Content

### ScrollView

- Use for small, known lists
- All children are rendered immediately
- Good for forms and short content

### FlatList

- **ALWAYS** use `FlatList` for long lists, never `ScrollView` with `map()`
- Virtualized rendering for performance
- Use `keyExtractor` prop
- Use `getItemLayout` if item heights are known
- Use `removeClippedSubviews` for performance
- Use `initialNumToRender` and `maxToRenderPerBatch` for optimization

```typescript
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemComponent item={item} />}
  contentContainerStyle={{ paddingBottom: insets.bottom }}
/>
```

## Platform Differences

- Always test on both iOS and Android
- Use `Platform.select()` for platform-specific logic
- Be aware of different keyboard behaviors
- Handle different safe area insets
- Consider different navigation patterns (iOS back button vs Android)

## Common Mistakes to Avoid

1. ❌ Using HTML elements (`div`, `span`, `button`)
2. ❌ Using `style` prop instead of `className` (use NativeWind)
3. ❌ Assuming content fits on screen (always use ScrollView/FlatList)
4. ❌ Not handling safe areas
5. ❌ Using `TouchableOpacity` instead of `Pressable`
6. ❌ Not handling keyboard overlap
7. ❌ Rendering long lists with `map()` instead of `FlatList`
