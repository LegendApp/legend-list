# Legend List

Legend List aims to be a drop-in replacement for FlatList with much better performance and supporting dynamically sized items.

## Caution: Experimental

This is an early release to test and gather feedback. It's not used in production yet and needs more work to reach parity with FlatList features.

## Features

In addition to normal FlatList features:

-   Dynamic layouts supported. Just use the `estimatedItemSize` prop to give a close estimate so that layouts aren't too far off, and positions will adjust while rendering.
-   `maintainScrollAtEnd`: If true and scroll is within `maintainScrollAtEndThreshold * screen height` then changing items or heights will scroll to the bottom. This can be useful for chat interfaces.
-   `recycleItems` prop enables toggling recycling of list items. If enabled it will reuse item components for improved performance, but it will reuse any local state in items. So if you have local state in items you likely want this disabled.

## Usage

## Install

`bun add @legendapp/list` or `npm install @legendapp/list` or `yarn add @legendapp/list`

### Props

We suggest using all of the required props and additionally `keyExtractor` to improve performance when adding/removing items.

#### Required

```ts
interface PropsRequired {
    data: ArrayLike<any> & T[];
    renderItem: (props: LegendListRenderItemInfo<T>) => ReactNode;
    estimatedItemSize: number;
}
```

#### Optional

```ts
interface PropsOptional {
    initialScrollOffset?: number;
    initialScrollIndex?: number;
    drawDistance?: number;
    initialContainers?: number;
    recycleItems?: boolean;
    onEndReachedThreshold?: number | null | undefined;
    maintainScrollAtEnd?: boolean;
    maintainScrollAtEndThreshold?: number;
    onEndReached?: ((info: { distanceFromEnd: number }) => void) | null | undefined;
    keyExtractor?: (item: T, index: number) => string;
    onViewableRangeChanged?: (range: ViewableRange<T>) => void;
}
```

## How to build

`npm run build` will build the package to the `dist` folder.

## How to run example

1. `cd example`
2. `npm i`
3. `npm run bootstrap-start`

## PRs gladly accepted!

There's not a lot of code here so hopefully it's easy to contribute. If you want to add a missing feature or fix a bug please post an issue to see if development is already in progress so we can make sure to not duplicate work 😀.

## TODO list

-   onViewableItemsChanged
-   Adjust scroll when item heights change above the viewable area so they don't jump
-   A prop to start with items at the bottom like a chat interface, just needs to pad the top with screen height - items height
-   Other important missing features from FlatList or other lists libraries
-   Optimizations:
    -   Loop over only potentially changed items when adjusting heights rather than data array

## Community

Join us on [Discord](https://discord.gg/tuW2pAffjA) to get involved with the Legend community.

## 👩‍⚖️ License

[MIT](LICENSE)
