# Migration Guide

## `LegendListDatasets` beta API cleanup

This guide covers the `LegendListDatasets` API cleanup that moved the component to dataset-aware top-level props.

### Summary

- Rename `activeKey` to `activeDatasetKey`.
- Rename `inactiveBehavior` to `inactiveDatasetBehavior`.
- Keep each dataset entry minimal: `key` and `data`.
- Move `renderItem`, `keyExtractor`, `getItemType`, `getEstimatedItemSize`, and `getFixedItemSize` to `LegendListDatasets`.
- Use the new `datasetKey` argument to branch per-dataset behavior.

There are no compatibility aliases for the old prop names or dataset-level callbacks.

### Before

```tsx
<LegendListDatasets
    activeKey={activeTab}
    inactiveBehavior="hide"
    datasets={[
        {
            key: "spots",
            data: spotRows,
            renderItem: renderSpotItem,
            keyExtractor: (item) => `spots:${item.id}`,
            getItemType: () => "spot-row",
        },
        {
            key: "futures",
            data: futuresRows,
            renderItem: renderFuturesItem,
            keyExtractor: (item) => `futures:${item.id}`,
            getItemType: () => "futures-row",
        },
    ]}
/>
```

### After

```tsx
<LegendListDatasets
    activeDatasetKey={activeTab}
    inactiveDatasetBehavior="hide"
    datasets={[
        { key: "spots", data: spotRows },
        { key: "futures", data: futuresRows },
    ]}
    keyExtractor={(item, _index, datasetKey) => `${datasetKey}:${item.id}`}
    getItemType={(_item, _index, datasetKey) =>
        datasetKey === "futures" ? "futures-row" : "spot-row"
    }
    renderItem={({ datasetKey, item, type }) =>
        datasetKey === "futures" ? (
            <FuturesRow item={item} type={type} />
        ) : (
            <SpotRow item={item} type={type} />
        )
    }
/>
```

### Callback signatures

```ts
type LegendListDataset<T> = {
    key: string;
    data: ReadonlyArray<T>;
};

type renderItem = (props: {
    datasetKey: string;
    data: readonly T[];
    extraData: unknown;
    index: number;
    item: T;
    type: string | undefined;
}) => React.ReactNode;

type keyExtractor = (item: T, index: number, datasetKey: string) => string;

type getItemType = (
    item: T,
    index: number,
    datasetKey: string,
) => string | undefined;

type getEstimatedItemSize = (
    item: T,
    index: number,
    type: string | undefined,
    datasetKey: string,
) => number;

type getFixedItemSize = (
    item: T,
    index: number,
    type: string | undefined,
    datasetKey: string,
) => number | undefined;
```

### Prop renames

| Old prop | New prop |
| --- | --- |
| `activeKey` | `activeDatasetKey` |
| `inactiveBehavior` | `inactiveDatasetBehavior` |

`inactiveDatasetBehavior` supports these values:

- `"pause"`: keep inactive datasets mounted but hidden with `React.Activity`. This is the default.
- `"hide"`: keep inactive datasets mounted and rendering, but visually hidden with `display: "none"`.
- `"unmount"`: unmount inactive datasets.

### Dataset entries

Dataset entries should only describe the dataset identity and data:

```ts
const datasets = [
    { key: "spots", data: spotRows },
    { key: "futures", data: futuresRows },
];
```

Do not put list callbacks on dataset entries anymore:

```ts
const datasets = [
    {
        key: "spots",
        data: spotRows,
        renderItem, // remove
        keyExtractor, // remove
        getItemType, // remove
    },
];
```

### Per-dataset keys and item types

If multiple datasets can contain items with the same item key, include `datasetKey` in `keyExtractor`:

```tsx
keyExtractor={(item, _index, datasetKey) => `${datasetKey}:${item.id}`}
```

If different datasets need different recycling pools, use `datasetKey` in `getItemType`:

```tsx
getItemType={(item, _index, datasetKey) => {
    if (item.type === "header") return "header";
    return datasetKey === "futures" ? "futures-row" : "spot-row";
}}
```

### Per-dataset size hints

Use `estimatedItemSize` when all datasets can share one estimate:

```tsx
<LegendListDatasets estimatedItemSize={72} />
```

Use `getEstimatedItemSize` or `getFixedItemSize` when a dataset needs a different size:

```tsx
getEstimatedItemSize={(item, _index, _type, datasetKey) => {
    if (item.type === "header") return 44;
    return datasetKey === "lend" ? 96 : 72;
}}
```

### Empty datasets

When there are no datasets, pass `activeDatasetKey=""` and `datasets={[]}`. `ListEmptyComponent` renders in that state:

```tsx
<LegendListDatasets
    activeDatasetKey=""
    datasets={[]}
    ListEmptyComponent={<EmptyState />}
    renderItem={() => null}
/>
```

### Checklist

1. Replace `activeKey` with `activeDatasetKey`.
2. Replace `inactiveBehavior` with `inactiveDatasetBehavior`.
3. Remove `renderItem`, `keyExtractor`, `getItemType`, and size callbacks from each dataset object.
4. Add top-level `renderItem`.
5. Move key/type/size logic to top-level callbacks and use `datasetKey`.
6. Include `datasetKey` in item keys when datasets can overlap.
