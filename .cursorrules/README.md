# Cursor Rules - Project Overview

This directory contains comprehensive coding rules organized by application layers. These rules guide development for AI agents and developers working on this React Native application.

## Project Stack

- **Expo Router** (v6+) - File-based routing
- **React Native Reusables** - UI component library (@rn-primitives)
- **NativeWind** (v4) - Tailwind CSS for React Native
- **Convex** - Backend-as-a-Service for real-time data
- **Clerk** - Authentication and user management
- **TypeScript** - Type safety throughout

## Rule Files

### Foundation Layer
- **[01-react-native.md](./01-react-native.md)** - Core React Native principles and best practices
- **[06-typescript.md](./06-typescript.md)** - TypeScript patterns and type safety

### Routing Layer
- **[02-expo-router.md](./02-expo-router.md)** - Expo Router patterns, navigation, and route protection

### UI & Styling Layer
- **[03-ui-styling.md](./03-ui-styling.md)** - React Native Reusables components and NativeWind styling

### Backend Layer
- **[04-convex.md](./04-convex.md)** - Convex integration, queries, mutations, and schema patterns
- **[05-clerk.md](./05-clerk.md)** - Clerk authentication setup and patterns

### Architecture Layer
- **[07-component-structure.md](./07-component-structure.md)** - Component organization and file structure
- **[08-state-management.md](./08-state-management.md)** - State management patterns (local and server state)
- **[09-error-handling.md](./09-error-handling.md)** - Error handling and error boundaries

### Optimization Layer
- **[10-performance.md](./10-performance.md)** - Performance optimization techniques
- **[11-platform-specific.md](./11-platform-specific.md)** - Platform-specific code patterns

### Development Layer
- **[12-development.md](./12-development.md)** - Code style, testing, and agent-friendly patterns
- **[13-common-patterns.md](./13-common-patterns.md)** - Common code patterns and snippets

### Migration Guide
- **[14-migration.md](./14-migration.md)** - Next.js to React Native migration notes

## Quick Reference Checklist

When writing code, ensure:
- [ ] Using React Native components, not HTML
- [ ] Using `className` for styling, not `style`
- [ ] Using Expo Router navigation hooks
- [ ] Handling loading states from Convex queries
- [ ] Checking `isLoaded` from Clerk hooks
- [ ] Using safe area insets for layouts
- [ ] Using TypeScript types throughout
- [ ] Using `cn()` for conditional classes
- [ ] Handling errors properly
- [ ] Using `FlatList` for long lists
- [ ] Testing on both iOS and Android

## Resources

- [Expo Router Docs](https://docs.expo.dev/router/introduction/)
- [React Native Reusables](https://reactnativereusables.com)
- [NativeWind Docs](https://www.nativewind.dev)
- [Convex Docs](https://docs.convex.dev)
- [Clerk React Native Docs](https://clerk.com/docs/references/react-native/overview)
- [React Native Docs](https://reactnative.dev/docs/getting-started)

