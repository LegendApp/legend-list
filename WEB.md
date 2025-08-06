# Complete Web Version Implementation Plan

## 1. Platform Abstraction Strategy

Create platform-specific modules that abstract React Native APIs to React DOM equivalents:

### **`src/platform/` Directory Structure:**
```
src/platform/
├── View.tsx              # div-based implementation
├── View.native.tsx       # React Native View
├── Text.tsx              # span-based implementation  
├── Text.native.tsx       # React Native Text
├── ScrollView.tsx        # div with overflow: auto
├── ScrollView.native.tsx # React Native ScrollView
├── Animated.tsx          # CSS-based animations
├── Animated.native.tsx   # React Native Animated
├── Platform.ts           # Web platform detection
├── Platform.native.ts    # React Native Platform
└── Layout.tsx            # ResizeObserver-based layout
└── Layout.native.tsx     # onLayout-based layout
```

### **Web Platform Implementations:**

**View.tsx (Web):**
```typescript
// div-based View equivalent
export const View = React.forwardRef<HTMLDivElement, ViewProps>((props, ref) => {
  return <div ref={ref} {...convertStyleProps(props)} />;
});
```

**ScrollView.tsx (Web):**
```typescript
// Scrollable div with scroll event handling
export const ScrollView = React.forwardRef<HTMLDivElement, ScrollViewProps>((props, ref) => {
  return (
    <div 
      ref={ref}
      style={{ overflow: 'auto', ...props.style }}
      onScroll={handleScrollEvent}
      {...props}
    />
  );
});
```

**Animated.tsx (Web):**
```typescript
// CSS-based animation system
export const Animated = {
  Value: (initialValue: number) => new CSSAnimatedValue(initialValue),
  View: (props) => <div style={convertAnimatedStyle(props.style)} {...props} />,
  event: (mapping, config) => createCSSScrollHandler(mapping, config),
};
```

**Layout.tsx (Web):**
```typescript
// ResizeObserver-based layout measurement
export const useLayout = (callback: (layout: LayoutRectangle) => void) => {
  // Implementation using ResizeObserver + getBoundingClientRect
};
```

## 2. Files That Need Platform Imports Updated

### **Update Import Strategy:**
Instead of importing from `'react-native'`, import from our platform abstractions:

```typescript
// Before:
import { View, ScrollView, Animated } from 'react-native';

// After:  
import { View } from '@/platform/View';
import { ScrollView } from '@/platform/ScrollView';
import { Animated } from '@/platform/Animated';
```

### **Files to Update:**
- `src/components/LegendList.tsx` - Update ScrollView, Animated, Platform imports
- `src/components/ListComponent.tsx` - Update View, Text, ScrollView imports
- `src/components/Container.tsx` - Update View, layout types imports
- `src/components/PositionView.tsx` - Update Animated.View, transform logic
- `src/components/LeanView.tsx` - Update to use platform View
- `src/components/ScrollAdjust.tsx` - Update Animated imports
- `src/components/SnapWrapper.tsx` - Update ScrollView imports
- `src/hooks/useAnimatedValue.ts` - Update Animated imports
- `src/hooks/useSyncLayout.tsx` - Update layout measurement

## 3. Core Logic Preservation

### **Files That Stay 100% Unchanged:**
- All `/core/` calculation functions
- All `/utils/` helper functions  
- All `/state/` management
- `src/types.ts` (mostly)
- Most business logic in components

### **Files With Minimal Changes (Import Updates Only):**
- `LegendList.tsx` (~95% unchanged)
- `Container.tsx` (~90% unchanged)
- `ListComponent.tsx` (~85% unchanged)

## 4. Web-Specific Implementations

### **CSS Transform System:**
```typescript
// Web positioning using CSS transforms
const WebPositionView = ({ position, horizontal, children, style }) => {
  const transform = horizontal 
    ? `translateX(${position}px)` 
    : `translateY(${position}px)`;
    
  return (
    <div style={{ 
      ...style, 
      transform,
      position: 'absolute'
    }}>
      {children}
    </div>
  );
};
```

### **Scroll Event Handling:**
```typescript
// Convert DOM scroll events to React Native format
const handleScrollEvent = (event: Event) => {
  const target = event.target as HTMLElement;
  return {
    nativeEvent: {
      contentOffset: {
        x: target.scrollLeft,
        y: target.scrollTop
      },
      contentSize: {
        width: target.scrollWidth,
        height: target.scrollHeight
      }
    }
  };
};
```

### **Layout Measurement:**
```typescript
// ResizeObserver-based layout detection
const useWebLayout = (callback: (layout: LayoutRectangle) => void) => {
  const ref = useRef<HTMLDivElement>(null);
  
  useLayoutEffect(() => {
    if (!ref.current) return;
    
    const observer = new ResizeObserver(([entry]) => {
      const { width, height, x, y } = entry.contentRect;
      callback({ width, height, x, y });
    });
    
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [callback]);
  
  return ref;
};
```

## 5. Build Configuration Updates

### **Package.json Conditional Exports:**
```json
{
  "exports": {
    ".": {
      "react-native": "./dist/index.native.js",
      "default": "./dist/index.js"
    },
    "./animated": {
      "react-native": "./dist/animated.native.js", 
      "default": "./dist/animated.js"
    }
  }
}
```

### **TSUp Configuration:**
```typescript
// tsup.config.ts updates
export default defineConfig([
  {
    // Web build
    entry: ['src/index.ts'],
    platform: 'browser',
    external: ['react', 'react-dom']
  },
  {
    // React Native build  
    entry: ['src/index.native.ts'],
    platform: 'node',
    external: ['react', 'react-native']
  }
]);
```

## 6. Example Web App (Vite)

### **Structure:**
```
example-web/
├── src/
│   ├── App.tsx              # Main demo app
│   ├── components/          # Demo components
│   ├── examples/            # Same demos as RN example
│   └── main.tsx            # Entry point
├── index.html
├── package.json            # Web dependencies
└── vite.config.ts
```

### **Key Features to Demo:**
- Dynamic item sizing with variable height content
- Infinite scrolling in both directions
- Chat UI with auto-scroll to bottom  
- Multi-column masonry layouts
- Smooth scroll animations
- Performance comparison with react-window/react-virtualized

## 7. Implementation Priority

### **Phase 1: Core Platform Abstractions**
1. Create `/platform/` directory with basic implementations
2. Update core component imports
3. Get basic scrolling working

### **Phase 2: Animation & Layout**  
1. Implement CSS-based animation system
2. Add ResizeObserver layout measurement
3. Handle scroll event conversion

### **Phase 3: Advanced Features**
1. Sticky headers with CSS position: sticky
2. Snap-to-index with CSS scroll-snap
3. Refresh control with custom implementation

### **Phase 4: Example & Polish**
1. Create Vite example app
2. Performance testing and optimization
3. Documentation updates

This approach preserves ~90% of the existing codebase while cleanly abstracting platform differences into dedicated modules.