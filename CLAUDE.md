# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- `bun run build` - Build the package using tsup and run post-build script
- `bun run publish:manual` - Build and publish to npm manually
- `bun run lint` - Check code formatting with Biome for src and example
- `bun run lint:fix` - Auto-fix formatting issues with Biome for src and example

### Example App Development
The repository includes a React Native example app in the `example/` directory:
- `cd example && bun i && bun run ios` - Run the example app on iOS
- Example app uses Expo and demonstrates various Legend List features

### Build Process
- Uses tsup for TypeScript compilation with multiple entry points:
  - `src/index.ts` (main export)
  - `src/integrations/animated.tsx` (animated variant)
  - `src/integrations/reanimated.tsx` (reanimated variant)
  - `src/integrations/keyboard-controller.tsx` (keyboard integration)
- Post-build script (`posttsup.ts`) copies LICENSE, CHANGELOG.md, README.md to dist and modifies package.json for publishing
- Builds to both CommonJS and ESM formats with TypeScript declarations

### File Structure
- `src/components/` - React components (LegendList, Container, ListComponent, etc.)
- `src/state/` - State management system (state.tsx, ContextContainer.ts)
- `src/core/` - Core logic functions (scroll handling, positioning, viewability)
- `src/utils/` - Utility functions (helpers, calculations, checks)
- `src/hooks/` - Custom React hooks
- `src/integrations/` - Optional integrations (animated, reanimated, keyboard-controller)

## Architecture Overview

Legend List is a high-performance React Native list component designed as a drop-in replacement for FlatList with better performance, especially for dynamically sized items.

### Core Components

**LegendList** (`src/components/LegendList.tsx`): Main component that wraps functionality in a StateProvider
- Handles virtualization logic, scroll management, and item positioning
- Manages anchor elements for `maintainVisibleContentPosition`
- Implements advanced scroll adjustment and jump prevention
- Uses container recycling for optimal performance

**State Management** (`src/state/state.tsx`): Global state management using observable patterns
- Manages container positions, item data, and scroll state
- Provides reactive updates to child components
- Custom state system inspired by Legend State with optimized listeners

**Container System** (`src/components/Container.tsx`, `src/components/Containers.tsx`): Manages item rendering containers
- Implements container recycling when `recycleItems` is enabled
- Handles absolute positioning of list items
- Manages container allocation and deallocation

**Scroll Adjustment** (`src/core/ScrollAdjustHandler.ts`): Handles complex scroll position adjustments
- Prevents scroll jumps when items are added/removed
- Manages scroll position during layout changes

### Key Features Architecture

**Dynamic Item Sizing**: Items can have varying heights without performance penalties
- Uses `getEstimatedItemSize` or `estimatedItemSize` for initial estimates
- Measures actual sizes on layout and adjusts total size calculations
- Maintains position accuracy through size change events

**Bidirectional Infinite Lists**: Supports infinite scrolling in both directions
- `onStartReached` and `onEndReached` callbacks with configurable thresholds
- Maintains scroll position when items are added to the beginning

**Chat UI Support**: 
- `alignItemsAtEnd` aligns content to bottom for chat interfaces
- `maintainScrollAtEnd` automatically scrolls to end when new items are added
- Avoids need for inverted lists which cause animation issues

**Column Support**: Multi-column layouts via `numColumns` prop
- Manages row heights when items have different sizes within the same row
- Handles column-aware positioning and gap calculations via `columnWrapperStyle`

### Performance Optimizations

**Virtualization**: Only renders items in the visible area plus buffer zones
- `drawDistance` controls how far ahead/behind to render items
- Dynamic buffer adjustment based on scroll velocity
- Container recycling to minimize React element creation/destruction

**Scroll Jump Prevention**: Sophisticated system to prevent visual jumps
- Anchor element tracking for `maintainVisibleContentPosition`
- Scroll history tracking for velocity calculations
- Position adjustment when item sizes change

**Batched Updates**: Groups layout calculations to reduce renders
- Uses `requestAnimationFrame` for batching size change calculations
- Optimizes container position updates

## Integration Patterns

### Basic Usage
Legend List is designed as a drop-in FlatList replacement:
```typescript
<LegendList
  data={data}
  renderItem={renderItem}
  keyExtractor={(item) => item.id}
  recycleItems={true}
/>
```

### Optional Integrations
- **Animated**: `@legendapp/list/animated` - Works with React Native Animated
- **Reanimated**: `@legendapp/list/reanimated` - Works with React Native Reanimated
- **Keyboard Controller**: `@legendapp/list/keyboard-controller` - Integrates with react-native-keyboard-controller

### Viewability Tracking
Supports advanced viewability detection:
- Compatible with FlatList's `viewabilityConfig` and `onViewableItemsChanged`
- Custom hooks available: `useViewability`, `useViewabilityAmount`

## Important Development Notes

- When working with container recycling (`recycleItems={true}`), be cautious about local state in item components
- The `keyExtractor` is crucial for performance and correct behavior when data changes
- Use `getEstimatedItemSize` for better performance with varying item sizes
- The component uses advanced scroll position management that should not be interfered with directly

## Configuration Files

- **Biome** (`biome.json`): Used for linting and formatting with specific rules for the project
- **TypeScript** (`tsconfig.json`): Configured for React Native with path mappings for internal imports
- **Cursor Rules**: `.cursor/rules/changelog.mdc` contains guidelines for maintaining the changelog

## Testing the Library

To test changes, use the comprehensive example app which demonstrates various scenarios including dynamic sizing, infinite loading, chat interfaces, and performance comparisons with FlatList.