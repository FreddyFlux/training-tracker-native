# Platform-Specific Code

## Platform Detection

```typescript
import { Platform } from 'react-native';

if (Platform.OS === 'ios') {
  // iOS-specific code
} else if (Platform.OS === 'android') {
  // Android-specific code
}

// Platform-specific values
const padding = Platform.select({
  ios: 20,
  android: 16,
  default: 16,
});
```

## Web-Specific Styles

Use responsive classes for web-specific styles:

```typescript
<View className="web:flex-row sm:grid sm:grid-cols-2">
```

## Platform-Specific Components

```typescript
import { Platform } from 'react-native';

const Button = Platform.select({
  ios: () => require('./ButtonIOS').default,
  android: () => require('./ButtonAndroid').default,
  default: () => require('./ButtonWeb').default,
})();
```

## Common Platform Differences

### Safe Areas
- iOS: Use `SafeAreaView` or `useSafeAreaInsets`
- Android: Usually handled automatically

### Shadows
- iOS: Use `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`
- Android: Use `elevation`
- Web: Use Tailwind `shadow-*` classes

### Keyboard
- iOS: `KeyboardAvoidingView` with `behavior="padding"`
- Android: `KeyboardAvoidingView` with `behavior="height"`

## Best Practices

- Test on both iOS and Android
- Use `Platform.select()` for platform-specific logic
- Use responsive classes for web-specific styles
- Prioritize mobile experience

