# Web Animated Removal Strategy

## Goal
Remove all Animated usage on web while maintaining the same component API and minimal code changes.

## Problem
Currently, web uses Animated polyfills which add unnecessary complexity. We want web to use regular DOM elements while React Native keeps full animated components.

## Key Insight
The main issue is that React Native can't use `.getValue()` on AnimatedValues in render, so we need the platform split to happen at the value level, not the component level.

## Minimal Platform Split Strategy

### 1. Web useValue$ Returns Actual Numbers

**`useValue$.ts`** (web):
```tsx
export function useValue$(key: ListenerType, params?: {...}) {
    const { getValue } = params || {};
    const [value] = useArr$([key]);
    return getValue ? getValue(value) : value; // Return actual number
}
```

**`useValue$.native.ts`** (native):
```tsx
// Returns AnimatedValue object (current implementation)
export function useValue$(key: ListenerType, params?: {...}) {
    // ... existing implementation that returns AnimatedValue
}
```

### 2. Component Aliases Handle Platform Differences

**`src/platform/AnimatedComponents.tsx`** (web):
```tsx
import React from "react";
import { View, ScrollView } from "@/platform";

// Web: expects regular number values
export const AnimatedView = React.forwardRef<HTMLDivElement, any>(({ style, ...props }, ref) => (
    <View ref={ref} style={style} {...props} />
));

export const AnimatedScrollView = ScrollView;
```

**`src/platform/AnimatedComponents.native.tsx`** (native):
```tsx
import { Animated } from "react-native";

// Native: expects AnimatedValue objects
export const AnimatedView = Animated.View;
export const AnimatedScrollView = Animated.ScrollView;
```

### 3. Create Platform-Specific Value Creators

**`src/platform/AnimatedValue.tsx`** (web):
```tsx
export const createAnimatedValue = (value: number) => value; // Just return the number
export const createAnimatedEvent = (mapping: any[], config?: any) => config?.listener || (() => {});
```

**`src/platform/AnimatedValue.native.tsx`** (native):
```tsx
import { Animated } from "react-native";
export const createAnimatedValue = (value: number) => new Animated.Value(value);
export const createAnimatedEvent = Animated.event;
```

### 4. Update Component Imports (Minimal Changes)

**`ListComponent.tsx`**:
```tsx
// Before:
import { Animated } from "@/platform/Animated";

// After:
import { AnimatedView, AnimatedScrollView } from "@/platform/AnimatedComponents";
```

### 5. Update State Files

**`state.tsx`**:
```tsx
// Before:
import { Animated } from "@/platform/Animated";
animatedScrollY: new Animated.Value(0),

// After:
import { createAnimatedValue } from "@/platform/AnimatedValue";
animatedScrollY: createAnimatedValue(0),
```

**`calculateItemsInView.ts`**:
```tsx
// Before:
set$(ctx, `containerStickyOffset${containerIndex}`, new Animated.Value(topPadding));

// After:
import { createAnimatedValue } from "@/platform/AnimatedValue";
set$(ctx, `containerStickyOffset${containerIndex}`, createAnimatedValue(topPadding));
```

### 6. Usage Stays Identical Across Platforms

**`ListComponent.tsx`**:
```tsx
import { AnimatedView } from "@/platform/AnimatedComponents";

const Padding = () => {
    const animPaddingTop = useValue$("alignItemsPaddingTop", { delay: 0 });

    // Works on both platforms:
    // - Web: animPaddingTop is a number
    // - Native: animPaddingTop is an AnimatedValue
    return <AnimatedView style={{ paddingTop: animPaddingTop }} />;
};
```

## Benefits of This Approach

- ✅ **No full file splits** - components stay as single files
- ✅ **No .getValue() calls needed** - values work naturally on both platforms
- ✅ **Same component code** - no platform-specific changes in main components
- ✅ **Minimal changes** - just import updates and platform-specific helper files
- ✅ **Web gets regular DOM** - AnimatedView becomes regular div on web
- ✅ **Native keeps performance** - Real animated components and values
- ✅ **Clean separation** - Platform differences isolated to small helper files

## Implementation Steps

1. Create `AnimatedComponents.{tsx,native.tsx}` files
2. Create `AnimatedValue.{tsx,native.tsx}` files
3. Update existing `useValue$.{ts,native.ts}` to return numbers vs AnimatedValues
4. Update component imports to use new aliases
5. Update state management to use `createAnimatedValue`
6. Remove the current `Animated.tsx` polyfill
7. Test both platforms

## Files That Need Updates

- `src/components/ListComponent.tsx` - import change
- `src/components/Containers.tsx` - import change
- `src/components/LegendList.tsx` - import change
- `src/state/state.tsx` - use `createAnimatedValue`
- `src/core/calculateItemsInView.ts` - use `createAnimatedValue`

## Result

Web version will have zero Animated complexity while maintaining identical component code and API surface.