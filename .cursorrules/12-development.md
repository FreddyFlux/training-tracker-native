# Development Practices

## Code Style & Formatting

### Imports

Group imports: React/React Native → Third-party → Local

```typescript
// React/React Native
import { useState } from 'react';
import { View, Text } from 'react-native';

// Third-party
import { useQuery } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';

// Local
import { Button } from '@/components/ui/button';
import { api } from '@/convex/_generated/api';
```

### Naming Conventions

- Components: PascalCase (`MyComponent`)
- Functions: camelCase (`handleSubmit`)
- Constants: UPPER_SNAKE_CASE (`API_URL`)
- Files: kebab-case (`my-component.tsx`)

### Formatting

- Use Prettier with Tailwind plugin
- 2-space indentation
- Trailing commas
- Semicolons

## Environment Variables

### Naming

- Use `EXPO_PUBLIC_` prefix for public variables
- Access via `process.env.EXPO_PUBLIC_*`
- **NEVER** expose secrets

### Common Variables

```typescript
// Public (client-side)
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
EXPO_PUBLIC_CONVEX_URL=https://...

// Private (Convex dashboard)
CLERK_SECRET_KEY=sk_...
```

## Testing Considerations

### Component Testing

- Test user interactions, not implementation
- Test loading and error states
- Test navigation flows
- Mock Convex hooks in tests

### Accessibility

- Use `accessibilityLabel` for screen readers
- Use `accessibilityRole` for semantic meaning
- Test with screen readers

## Agent-Friendly Patterns

### When Writing Code for AI Agents

- **ALWAYS** provide clear context in comments
- Use descriptive variable and function names
- Break complex functions into smaller, well-named functions
- Add JSDoc comments for complex logic
- Use TypeScript types to document expected shapes
- Include examples in comments when patterns are non-obvious

### Code Organization

- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Group related functionality together
- Use consistent patterns across the codebase

### Error Messages

- Provide helpful error messages
- Include context in error logs
- Use error boundaries to prevent crashes

