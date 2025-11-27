# UI & Styling - React Native Reusables + NativeWind

## React Native Reusables (@rn-primitives)

### Component Usage

- **ALWAYS** import from `@/components/ui/` for UI components
- Use `@rn-primitives/*` packages directly only when needed
- Components follow shadcn/ui patterns but adapted for React Native
- Common components: `Button`, `Card`, `Input`, `Label`, `Text`, `Separator`, `Avatar`, `Popover`

### Component Patterns

- Use `Slot` from `@rn-primitives/slot` for composition
- Use `Portal` and `PortalHost` for modals/overlays
- Components accept `className` prop for NativeWind styling
- Use `cn()` utility from `@/lib/utils` for conditional classes

### Button Component

```typescript
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

<Button onPress={handlePress} variant="default" size="default">
  <Text>Button Text</Text>
</Button>

// Variants: default, destructive, outline, secondary, ghost, link
// Sizes: default, sm, lg, icon
```

### Input Component

```typescript
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<View className="gap-1.5">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    placeholder="email@example.com"
    keyboardType="email-address"
    autoComplete="email"
    autoCapitalize="none"
    onChangeText={setEmail}
  />
</View>
```

### Card Component

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

<Card className="border-border shadow-sm">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Text Component

```typescript
import { Text } from '@/components/ui/text';

// Use Text component instead of React Native Text for consistent styling
<Text className="text-xl font-bold">Heading</Text>
<Text className="text-sm text-muted-foreground">Subtitle</Text>
```

## NativeWind (Tailwind CSS for React Native)

### Styling Approach

- **ALWAYS** use `className` prop for styling, not `style` prop (unless absolutely necessary)
- Use Tailwind utility classes: `flex`, `gap-4`, `p-4`, `rounded-lg`, etc.
- Use responsive classes: `sm:`, `md:`, `lg:` for web breakpoints
- Use dark mode classes: `dark:bg-background`
- Use `cn()` utility for conditional/merged classes

### cn() Utility

```typescript
import { cn } from '@/lib/utils';

// Conditional classes
<View className={cn(
  'flex-1 p-4',
  isActive && 'bg-primary',
  error && 'border-destructive'
)}>

// Merged classes
<View className={cn('base-class', additionalClasses)}>
```

### Color System

Use semantic color tokens:

- `bg-background` / `text-foreground` - Main background and text
- `bg-primary` / `text-primary-foreground` - Primary actions
- `bg-secondary` / `text-secondary-foreground` - Secondary elements
- `bg-destructive` / `text-destructive-foreground` - Destructive actions
- `bg-muted` / `text-muted-foreground` - Muted/secondary text
- `bg-accent` / `text-accent-foreground` - Accent elements
- `border-border` - Borders

Colors are defined in `tailwind.config.js` using HSL variables:
- Access via `hsl(var(--primary))` pattern
- Theme colors adapt to light/dark mode automatically

### Layout Patterns

```typescript
// Container with padding
<View className="flex-1 p-4 gap-4">

// Flex row with spacing
<View className="flex-row items-center gap-2">

// Centered content
<View className="flex-1 items-center justify-center">

// Grid-like layout (web)
<View className="web:grid web:grid-cols-2 web:gap-4">
```

### Common Utility Classes

#### Spacing
- `p-{n}` - Padding (p-1, p-2, p-4, etc.)
- `px-{n}` - Horizontal padding
- `py-{n}` - Vertical padding
- `m-{n}` - Margin
- `gap-{n}` - Gap between children

#### Flexbox
- `flex-1` - Fill available space
- `flex-row` - Horizontal layout
- `flex-col` - Vertical layout
- `items-center` - Center items vertically
- `justify-center` - Center items horizontally
- `justify-between` - Space between items

#### Sizing
- `w-full` - Full width
- `h-full` - Full height
- `w-{n}` / `h-{n}` - Fixed width/height

#### Typography
- `text-{size}` - text-xs, text-sm, text-base, text-lg, text-xl, text-2xl
- `font-bold` - Bold text
- `font-medium` - Medium weight
- `text-center` - Center text
- `text-muted-foreground` - Muted text color

#### Borders & Radius
- `rounded-lg` - Large border radius
- `rounded-md` - Medium border radius
- `rounded-sm` - Small border radius
- `border` - Border
- `border-border` - Border color

#### Shadows
- `shadow-sm` - Small shadow (web only)
- `shadow-md` - Medium shadow (web only)
- Use `elevation` prop on Android for shadows

### Platform-Specific Styles

```typescript
// Use responsive classes for web-specific styles
<View className="web:flex-row sm:grid sm:grid-cols-2">

// Use Platform.select() for platform-specific logic (not styles)
import { Platform } from 'react-native';

const padding = Platform.select({
  ios: 20,
  android: 16,
  default: 16,
});
```

### Dark Mode

```typescript
// Dark mode classes
<View className="bg-background dark:bg-background">
<Text className="text-foreground dark:text-foreground">

// Dark mode is handled automatically via theme
```

## Form Patterns

### Form with Validation

```typescript
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';

const [email, setEmail] = useState('');
const [error, setError] = useState('');

<View className="gap-1.5">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    value={email}
    onChangeText={setEmail}
    keyboardType="email-address"
    autoCapitalize="none"
  />
  {error && (
    <Text className="text-sm text-destructive">{error}</Text>
  )}
</View>
```

### Input Focus Management

```typescript
import { useRef } from 'react';
import { TextInput } from 'react-native';

const passwordInputRef = useRef<TextInput>(null);

<Input
  ref={emailInputRef}
  onSubmitEditing={() => passwordInputRef.current?.focus()}
  returnKeyType="next"
/>

<Input
  ref={passwordInputRef}
  returnKeyType="done"
/>
```

## Common Mistakes to Avoid

1. ❌ Using `style` prop instead of `className`
2. ❌ Not using `cn()` for conditional classes
3. ❌ Using React Native `Text` instead of `@/components/ui/text`
4. ❌ Not handling platform-specific styles correctly
5. ❌ Using hardcoded colors instead of semantic tokens
6. ❌ Not using responsive classes for web
7. ❌ Forgetting to wrap Button content in Text component

