# Datasets

`LegendListDatasets` lets you render multiple independent lists under a single shared header, footer, and scroll container. This is useful when you have tabbed interfaces where each tab shows a different set of list items — switching between tabs is near-instant because each dataset's containers stay mounted and positioned.

---

## 🤔 Why Datasets?

The common approach to tabbed lists is either:

1. **One list, swap the data** — Every tab switch triggers a full recalculation of positions, container allocation, and item rendering. Expensive.
2. **Multiple lists in a pager** — Each list has its own ScrollView, so you lose the shared header and need complex scroll synchronization.
3. **Duplicate the whole screen** — Works, but you get N headers, N scroll positions, and N separate scroll containers.

`LegendListDatasets` solves all three:

* **One ScrollView** with one shared header and footer
* **N independent list engines** — each dataset has its own container pool, position map, and size cache
* **Near-instant tab switching** — inactive datasets keep their native layout warm and skip recalculation when reactivated at a similar scroll position
* **React.Activity integration** — inactive datasets use `<Activity mode="hidden">` to freeze effects while preserving component state

---

## 💻 Basic Usage

```tsx
import { LegendListDatasets } from "@legendapp/list";
import type { DatasetEntry } from "@legendapp/list";

const [activeTab, setActiveTab] = useState<"recent" | "popular" | "favorites">("recent");

const datasets: DatasetEntry<Item>[] = [
    { key: "recent", data: recentItems, active: activeTab === "recent" },
    { key: "popular", data: popularItems, active: activeTab === "popular" },
    { key: "favorites", data: favoriteItems, active: activeTab === "favorites" },
];

<LegendListDatasets
    datasets={datasets}
    renderItem={({ item }) => <ItemRow item={item} />}
    keyExtractor={(item) => item.id}
    estimatedItemSize={60}
    recycleItems
    ListHeaderComponent={
        <View>
            <ProfileHeader />
            <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        </View>
    }
/>
```

Only **one** dataset should have `active: true` at a time. The active dataset's items participate in scroll layout. Inactive datasets are hidden with `opacity: 0` and `pointerEvents: 'none'` — their containers stay mounted and positioned so switching back is instant.

---

## ✨ DatasetEntry Props

Each entry in the `datasets` array supports these properties:

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | Yes | Unique key for this dataset. Used as a React key. |
| `data` | `ReadonlyArray<T>` | Yes | The data array for this dataset. |
| `active` | `boolean` | Yes | Whether this dataset is currently visible. Only one should be `true`. |
| `dataVersion` | `Key` | No | Per-dataset version token. Increment when mutating data in place. |
| `keyExtractor` | `(item, index) => string` | No | Per-dataset key extractor. Falls back to the shared prop. |
| `estimatedItemSize` | `number` | No | Per-dataset estimated item size. Falls back to the shared prop. |
| `getEstimatedItemSize` | `(index, item, type) => number` | No | Per-dataset dynamic size estimator. Falls back to the shared prop. |
| `getFixedItemSize` | `(index, item, type) => number \| undefined` | No | Per-dataset fixed size function. Falls back to the shared prop. |
| `getItemType` | `(item, index) => string \| undefined` | No | Per-dataset item type function for container recycling. Falls back to the shared prop. |

All other LegendList props (`renderItem`, `recycleItems`, `drawDistance`, `maintainVisibleContentPosition`, etc.) are passed to `LegendListDatasets` directly and shared across all datasets.

---

## 📐 How It Works

### Architecture

```
Animated.ScrollView (shared)
├── Header (shared, measured once, size broadcast to all datasets)
├── DatasetLayer[0] — active:  normal layout flow, receives scroll events
├── DatasetLayer[1] — inactive: opacity 0, pointer events disabled
├── DatasetLayer[2] — inactive: opacity 0, pointer events disabled
└── Footer (shared, measured once, size broadcast to all datasets)
```

Each `DatasetLayer` is a full, independent LegendList engine wrapped in:
1. **`StateProvider`** — creates a fresh `StateContext` with its own positions, sizes, container pool, and scroll state
2. **`React.Activity`** — `mode="visible"` when active, `"hidden"` when inactive (freezes effects, preserves state)

### Scroll Routing

Only the **active** dataset receives scroll events. When the user scrolls, the parent ScrollView captures the offset and routes it to the active layer's `onScrollOffset()`, which updates its internal scroll state and runs `calculateItemsInView`.

Inactive datasets never receive scroll events — they're frozen at whatever state they were in when deactivated.

### Tab Switching

When a new dataset becomes active:

1. Its scroll state is updated to the current scroll offset
2. `calculateItemsInView` runs — but if the scroll position is still within the previously cached visible range, it **early-returns** and skips all work
3. The dataset's wrapper style switches from `opacity: 0` to visible

This means switching back to a tab you were just on is nearly free — the containers are already allocated, positioned, and rendered.

### Shared Header & Footer

The `ListHeaderComponent` and `ListFooterComponent` are rendered once in the parent ScrollView. When they're measured, their sizes are broadcast to **every** dataset so each layer's position calculations correctly account for the header/footer offset.

---

## ⚡ Performance Tips

* **Use `estimatedItemSize` or `getEstimatedItemSize`** — Good estimates reduce layout thrash during initial container allocation for each dataset.
* **Use per-dataset `dataVersion`** — If you mutate a data array in place (same reference), increment that dataset's `dataVersion` to force LegendList to detect the change.
* **Use per-dataset `keyExtractor`** — If your datasets have different item shapes (e.g., one tab shows orders, another shows trades), provide a per-dataset `keyExtractor` so each dataset resolves keys from the correct field.

---

## ⚠️ Common Footguns

### 1. Multiple datasets with `active: true`

Only one dataset should be active at a time. If multiple are active, only the first active one will receive scroll events and contribute to scroll content size — the others will be in an undefined layout state.

### 2. Forgetting `key` on datasets

Each `DatasetEntry` requires a unique `key`. This is used as the React key for the dataset layer. If keys are duplicated or missing, React will remount layers on every render and you'll lose all the performance benefits.

### 3. Inline `datasets` array

```tsx
// ❌ Bad — creates a new array every render, triggers unnecessary re-renders
<LegendListDatasets
    datasets={[
        { key: "a", data: dataA, active: true },
        { key: "b", data: dataB, active: false },
    ]}
/>

// ✅ Good — memoize the datasets array
const datasets = useMemo(() => [
    { key: "a", data: dataA, active: activeTab === "a" },
    { key: "b", data: dataB, active: activeTab === "b" },
], [dataA, dataB, activeTab]);

<LegendListDatasets datasets={datasets} />
```

### 4. Deriving data arrays inside `useMemo`

`DatasetLayer` is memoized — it skips re-render when its `data` reference hasn't changed. But if you derive data arrays inside the same `useMemo` that builds the `datasets` array, changing *any* dependency recreates *every* data array:

```tsx
// ❌ Bad — when activeTab changes, both .filter() calls run and produce new
// array references, causing ALL dataset layers to re-render
const datasets = useMemo(() => [
    { key: "a", data: items.filter(i => i.tab === "a"), active: activeTab === "a" },
    { key: "b", data: items.filter(i => i.tab === "b"), active: activeTab === "b" },
], [items, activeTab]);

// ✅ Good — memoize each data array independently so only the one whose
// source changed gets a new reference
const dataA = useMemo(() => items.filter(i => i.tab === "a"), [items]);
const dataB = useMemo(() => items.filter(i => i.tab === "b"), [items]);

const datasets = useMemo(() => [
    { key: "a", data: dataA, active: activeTab === "a" },
    { key: "b", data: dataB, active: activeTab === "b" },
], [dataA, dataB, activeTab]);
```

Now when `activeTab` changes, `dataA` and `dataB` are the same references — only the `active` booleans change, and the memo on each `DatasetLayer` sees the same `data` prop and skips the re-render.

### 5. Inline `renderItem` and callback props

`LegendListDatasets` stabilizes `renderItem`, `keyExtractor`, `onEndReached`, `onStartReached`, and `onViewableItemsChanged` via refs internally — so un-memoized inline functions won't cause all dataset layers to re-render. However, other callback props should still be memoized with `useCallback` for best performance.

---

## 📚 Full Example

A complete example with a tab bar header and three datasets:

```tsx
import { useState, useMemo, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LegendListDatasets } from "@legendapp/list";
import type { DatasetEntry } from "@legendapp/list";

type Item = { id: string; title: string; subtitle: string };

const TabBar = ({ activeTab, onTabChange }: {
    activeTab: string;
    onTabChange: (tab: string) => void;
}) => (
    <View style={styles.tabBar}>
        {["recent", "popular", "favorites"].map((tab) => (
            <Pressable
                key={tab}
                onPress={() => onTabChange(tab)}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
            >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
            </Pressable>
        ))}
    </View>
);

export default function DatasetsExample() {
    const [activeTab, setActiveTab] = useState("recent");

    const datasets: DatasetEntry<Item>[] = useMemo(() => [
        { key: "recent", data: recentItems, active: activeTab === "recent" },
        { key: "popular", data: popularItems, active: activeTab === "popular" },
        { key: "favorites", data: favoriteItems, active: activeTab === "favorites" },
    ], [activeTab]);

    const renderItem = useCallback(({ item }: { item: Item }) => (
        <View style={styles.item}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>
    ), []);

    return (
        <LegendListDatasets
            datasets={datasets}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            estimatedItemSize={72}
            recycleItems
            ListHeaderComponent={
                <View>
                    <Text style={styles.heading}>My App</Text>
                    <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
                </View>
            }
        />
    );
}
```

---

## 🔌 API Reference

`LegendListDatasets` accepts all `LegendList` props except `data` and `children`, plus:

| Prop | Type | Description |
|------|------|-------------|
| `datasets` | `DatasetEntry<T>[]` | Array of dataset entries. Each has its own `key`, `data`, and `active` flag. |
| `renderItem` | `(props) => ReactNode` | Shared render function for all datasets. Receives `LegendListRenderItemProps` with an optional item type. |

The imperative ref (`LegendListRef`) delegates all methods to the **active** dataset — `scrollToIndex`, `scrollToEnd`, `getState`, etc. all operate on whichever dataset is currently active.
