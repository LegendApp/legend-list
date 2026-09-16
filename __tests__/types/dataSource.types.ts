import type { AnimatedLegendListProps } from "../../src/integrations/reanimated";
import type { SectionListProps } from "../../src/section-list/SectionList";
import type { LegendListProps as NativeLegendListProps } from "../../src/types.react-native";
import type {
    DataSourceMutationBatch,
    LegendListArrayDataModeProps,
    LegendListDataMode,
    LegendListDataSource,
    LegendListDataSourceModeProps,
    LegendListProps,
} from "../../src/types.web";

interface Item {
    id: string;
    label: string;
}

type Expect<T extends true> = T;
type IsAssignable<From, To> = From extends To ? true : false;
type Not<T extends boolean> = T extends false ? true : false;

declare const source: LegendListDataSource<Item>;

const arrayMode: LegendListArrayDataModeProps<Item, undefined> = {
    data: [{ id: "a", label: "Alpha" }],
    renderItem: ({ item }) => item.label,
};

const dataSourceMode: LegendListDataSourceModeProps<Item, undefined> = {
    dataSource: source,
    renderItem: ({ dataSource, index, item }) => item?.label ?? `Loading ${dataSource.getKey(index)}`,
};

const dataSourceListProps: LegendListProps<Item, undefined> = dataSourceMode;

const mutationBatch: DataSourceMutationBatch = {
    length: 11,
    operations: [
        { deleteCount: 1, index: 4, insertCount: 2, type: "splice" },
        { count: 1, from: 0, to: 5, type: "move" },
        { count: 3, index: 2, layout: "invalidate", type: "update" },
    ],
    previousLength: 10,
    previousRevision: 2,
    revision: 3,
};

type BothModes = {
    data: readonly Item[];
    dataSource: LegendListDataSource<Item>;
    renderItem: (...args: any[]) => unknown;
};

type MissingModes = {
    renderItem: (...args: any[]) => unknown;
};

type _ArrayModeIsAccepted = Expect<IsAssignable<typeof arrayMode, LegendListDataMode<Item, undefined>>>;
type _DataSourceModeIsAccepted = Expect<IsAssignable<typeof dataSourceMode, LegendListDataMode<Item, undefined>>>;
type _BothModesAreRejected = Expect<Not<IsAssignable<BothModes, LegendListDataMode<Item, undefined>>>>;
type _MissingModesAreRejected = Expect<Not<IsAssignable<MissingModes, LegendListDataMode<Item, undefined>>>>;

void mutationBatch;
void dataSourceListProps;

// Event callbacks must expose unloaded items without weakening array-mode callbacks.
const sourceCallbacks: LegendListProps<Item> = {
    dataSource: source,
    getFixedItemSize: (item) => item.label.length,
    getItemType: (item) => item.id,
    onFirstVisibleItemChanged: ({ item }) => {
        const maybeItem: Item | undefined = item;
        // @ts-expect-error Data-source events may describe an unloaded row.
        const loaded: Item = item;
        void maybeItem;
        void loaded;
    },
    onItemSizeChanged: ({ itemData }) => {
        // @ts-expect-error Placeholder measurements have no loaded item.
        const loaded: Item = itemData;
        void loaded;
    },
    onViewableItemsChanged: ({ viewableItems }) => {
        // @ts-expect-error Viewability includes unloaded rows.
        const loaded: Item = viewableItems[0].item;
        void loaded;
    },
    overrideItemLayout: (layout, item) => {
        layout.span = item.label.length;
    },
    renderItem: () => null,
    viewabilityConfigCallbackPairs: [
        {
            onViewableItemsChanged: ({ changed }) => {
                // @ts-expect-error Custom viewability configurations also include unloaded rows.
                const loaded: Item = changed[0].item;
                void loaded;
            },
            viewabilityConfig: {},
        },
    ],
};
const arrayCallbacks: LegendListProps<Item> = {
    data: [],
    onFirstVisibleItemChanged: ({ item }) => {
        const loaded: Item = item;
        void loaded;
    },
    onItemSizeChanged: ({ itemData }) => {
        const loaded: Item = itemData;
        void loaded;
    },
    onViewableItemsChanged: ({ viewableItems }) => {
        const loaded: Item = viewableItems[0].item;
        void loaded;
    },
    renderItem: ({ item }) => item.label,
    viewabilityConfigCallbackPairs: [
        {
            onViewableItemsChanged: ({ changed }) => {
                const loaded: Item = changed[0].item;
                void loaded;
            },
            viewabilityConfig: {},
        },
    ],
};
void sourceCallbacks;
void arrayCallbacks;

// SectionList always flattens into array mode, so its callbacks retain contextual types.
const sectionCallbacks: SectionListProps<Item> = {
    onFirstVisibleItemChanged: ({ item }) => {
        item.kind;
        // @ts-expect-error Flat section items are typed, not any.
        item.unknownProperty;
    },
    onItemSizeChanged: ({ itemData }) => {
        itemData.kind;
        // @ts-expect-error Flat section items are typed, not any.
        itemData.unknownProperty;
    },
    sections: [],
    viewabilityConfigCallbackPairs: [
        {
            onViewableItemsChanged: ({ viewableItems }) => {
                viewableItems[0].item.kind;
                // @ts-expect-error Flat section items are typed, not any.
                viewableItems[0].item.unknownProperty;
            },
            viewabilityConfig: {},
        },
    ],
};
void sectionCallbacks;

type FirstVisibleItem<Props extends { onFirstVisibleItemChanged?: (info: any) => void }> = Parameters<
    NonNullable<Props["onFirstVisibleItemChanged"]>
>[0]["item"];
type NativeSourceProps = Extract<NativeLegendListProps<Item>, { dataSource: LegendListDataSource<Item> }>;
type NativeArrayProps = Extract<NativeLegendListProps<Item>, { data: readonly Item[] }>;
type AnimatedSourceProps = Extract<AnimatedLegendListProps<Item>, { dataSource: LegendListDataSource<Item> }>;
type AnimatedArrayProps = Extract<AnimatedLegendListProps<Item>, { data: readonly Item[] }>;
type _NativeSourceEventsAllowUnloaded = Expect<IsAssignable<undefined, FirstVisibleItem<NativeSourceProps>>>;
type _NativeArrayEventsRequireLoaded = Expect<Not<IsAssignable<undefined, FirstVisibleItem<NativeArrayProps>>>>;
type _AnimatedSourceEventsAllowUnloaded = Expect<IsAssignable<undefined, FirstVisibleItem<AnimatedSourceProps>>>;
type _AnimatedArrayEventsRequireLoaded = Expect<Not<IsAssignable<undefined, FirstVisibleItem<AnimatedArrayProps>>>>;
