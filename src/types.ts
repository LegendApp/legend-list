import { type ComponentProps, forwardRef, memo, type ReactNode } from "react";
import type {
    Animated,
    LayoutRectangle,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollResponderMixin,
    ScrollView,
    ScrollViewComponent,
    ScrollViewProps,
    StyleProp,
    ViewStyle,
} from "react-native";
import type Reanimated from "react-native-reanimated";

import type { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";

// Base ScrollView props with exclusions
type BaseScrollViewProps<TScrollView> = Omit<
    TScrollView,
    | "contentOffset"
    | "contentInset"
    | "maintainVisibleContentPosition"
    | "stickyHeaderIndices"
    | "removeClippedSubviews"
    | "children"
    | "onScroll"
>;

// Core props for data mode
interface DataModeProps<ItemT, TItemType extends string | undefined> {
    /**
     * Array of items to render in the list.
     * @required when using data mode
     */
    data: ReadonlyArray<ItemT>;

    /**
     * Function or React component to render each item in the list.
     * Can be either:
     * - A function: (props: LegendListRenderItemProps<ItemT>) => ReactNode
     * - A React component: React.ComponentType<LegendListRenderItemProps<ItemT>>
     * @required when using data mode
     */
    renderItem:
        | ((props: LegendListRenderItemProps<ItemT, TItemType>) => ReactNode)
        | React.ComponentType<LegendListRenderItemProps<ItemT, TItemType>>;

    children?: never;
}

// Core props for children mode
interface ChildrenModeProps {
    /**
     * React children elements to render as list items.
     * Each child will be treated as an individual list item.
     * @required when using children mode
     */
    children: ReactNode;

    data?: never;
    renderItem?: never;
}

// Shared Legend List specific props
interface LegendListSpecificProps<ItemT, TItemType extends string | undefined> {
    /**
     * If true, aligns items at the end of the list.
     * @default false
     */
    alignItemsAtEnd?: boolean;

    /**
     * If true, enables using average sizes for performance optimization.
     * @default true
     */
    enableAverages?: boolean;

    /**
     * Style applied to each column's wrapper view.
     */
    columnWrapperStyle?: ColumnWrapperStyle;

    /**
     * Distance in pixels to pre-render items ahead of the visible area.
     * @default 250
     */
    drawDistance?: number;

    /**
     * Estimated size of each item in pixels, a hint for the first render. After some
     * items are rendered, the average size of rendered items will be used instead.
     * @default undefined
     */
    estimatedItemSize?: number;

    /**
     * Estimated size of the ScrollView in pixels, a hint for the first render to improve performance
     * @default undefined
     */
    estimatedListSize?: { height: number; width: number };

    /**
     * Extra data to trigger re-rendering when changed.
     */
    extraData?: any;

    /**
     * In case you have distinct item sizes, you can provide a function to get the size of an item.
     * Use instead of FlatList's getItemLayout or FlashList overrideItemLayout if you want to have accurate initialScrollOffset, you should provide this function
     */
    getEstimatedItemSize?: (index: number, item: ItemT, type: TItemType) => number;

    /**
     * Ratio of initial container pool size to data length (e.g., 0.5 for half).
     * @default 2
     */
    initialContainerPoolRatio?: number | undefined;

    /**
     * Initial scroll position in pixels.
     * @default 0
     */
    initialScrollOffset?: number;

    /**
     * Index to scroll to initially.
     * @default 0
     */
    initialScrollIndex?:
        | number
        | {
              index: number;
              viewOffset?: number | undefined;
          };

    /**
     * Component to render between items, receiving the leading item as prop.
     */
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;

    /**
     * Function to extract a unique key for each item.
     */
    keyExtractor?: (item: ItemT, index: number) => string;

    /**
     * Component or element to render when the list is empty.
     */
    ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;

    /**
     * Component or element to render below the list.
     */
    ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;

    /**
     * Style for the footer component.
     */
    ListFooterComponentStyle?: StyleProp<ViewStyle> | undefined;

    /**
     * Component or element to render above the list.
     */
    ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;

    /**
     * Style for the header component.
     */
    ListHeaderComponentStyle?: StyleProp<ViewStyle> | undefined;

    /**
     * If true, auto-scrolls to end when new items are added.
     * @default false
     */
    maintainScrollAtEnd?: boolean | MaintainScrollAtEndOptions;

    /**
     * Distance threshold in percentage of screen size to trigger maintainScrollAtEnd.
     * @default 0.1
     */
    maintainScrollAtEndThreshold?: number;

    /**
     * If true, maintains visibility of content during scroll (e.g., after insertions).
     * @default true
     */
    maintainVisibleContentPosition?: boolean;

    /**
     * Number of columns to render items in.
     * @default 1
     */
    numColumns?: number;

    /**
     * Called when scrolling reaches the end within onEndReachedThreshold.
     */
    onEndReached?: ((info: { distanceFromEnd: number }) => void) | null | undefined;

    /**
     * How close to the end (in fractional units of visible length) to trigger onEndReached.
     * @default 0.5
     */
    onEndReachedThreshold?: number | null | undefined;

    /**
     * Called when an item's size changes.
     */
    onItemSizeChanged?: (info: {
        size: number;
        previous: number;
        index: number;
        itemKey: string;
        itemData: ItemT;
    }) => void;

    /**
     * Function to call when the user pulls to refresh.
     */
    onRefresh?: () => void;

    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

    /**
     * Called when scrolling reaches the start within onStartReachedThreshold.
     */
    onStartReached?: ((info: { distanceFromStart: number }) => void) | null | undefined;

    /**
     * How close to the start (in fractional units of visible length) to trigger onStartReached.
     * @default 0.5
     */
    onStartReachedThreshold?: number | null | undefined;

    /**
     * Called when the viewability of items changes.
     */
    onViewableItemsChanged?: OnViewableItemsChanged<ItemT> | undefined;

    /**
     * Offset in pixels for the refresh indicator.
     * @default 0
     */
    progressViewOffset?: number;

    /**
     * If true, recycles item views for better performance.
     * @default false
     */
    recycleItems?: boolean;

    /**
     * Ref to the underlying ScrollView component.
     */
    refScrollView?: React.Ref<ScrollView>;

    /**
     * If true, shows a refresh indicator.
     * @default false
     */
    refreshing?: boolean;

    /**
     * Render custom ScrollView component.
     * @default (props) => <ScrollView {...props} />
     */
    renderScrollComponent?: (props: ScrollViewProps) => React.ReactElement<ScrollViewProps>;

    /**
     * This will log a suggested estimatedItemSize.
     * @required
     * @default false
     */
    suggestEstimatedItemSize?: boolean;

    /**
     * Configuration for determining item viewability.
     */
    viewabilityConfig?: ViewabilityConfig;

    /**
     * Pairs of viewability configs and their callbacks for tracking visibility.
     */
    viewabilityConfigCallbackPairs?: ViewabilityConfigCallbackPairs<ItemT> | undefined;

    /**
     * If true, delays rendering until initial layout is complete.
     * @default false
     */
    waitForInitialLayout?: boolean;

    onLoad?: (info: { elapsedTimeInMs: number }) => void;

    snapToIndices?: number[];

    /**
     * Array of child indices determining which children get docked to the top of the screen when scrolling.
     * For example, passing stickyIndices={[0]} will cause the first child to be fixed to the top of the scroll view.
     * Not supported in conjunction with horizontal={true}.
     * @default undefined
     */
    stickyIndices?: number[];

    getItemType?: (item: ItemT, index: number) => TItemType;

    getFixedItemSize?: (index: number, item: ItemT, type: TItemType) => number;

    itemsAreEqual?: (itemPrevious: ItemT, item: ItemT, index: number, data: readonly ItemT[]) => boolean;
}

// Clean final type composition
export type LegendListPropsBase<
    ItemT,
    TScrollView extends
        | ComponentProps<typeof ScrollView>
        | ComponentProps<typeof Animated.ScrollView>
        | ComponentProps<typeof Reanimated.ScrollView>,
    TItemType extends string | undefined = string | undefined,
> = BaseScrollViewProps<TScrollView> &
    LegendListSpecificProps<ItemT, TItemType> &
    (DataModeProps<ItemT, TItemType> | ChildrenModeProps);

export interface MaintainScrollAtEndOptions {
    onLayout?: boolean;
    onItemLayout?: boolean;
    onDataChange?: boolean;
}

export interface ColumnWrapperStyle {
    rowGap?: number;
    gap?: number;
    columnGap?: number;
}

export type LegendListProps<ItemT = any> = LegendListPropsBase<ItemT, ComponentProps<typeof ScrollView>>;

export interface InternalState {
    positions: Map<string, number>;
    columns: Map<string, number>;
    sizes: Map<string, number>;
    sizesKnown: Map<string, number>;
    containerItemKeys: Set<string>;
    containerItemTypes: Map<number, string>;
    isStartReached: boolean;
    isEndReached: boolean;
    isAtEnd: boolean;
    isAtStart: boolean;
    hasScrolled?: boolean;
    scrollLength: number;
    startBuffered: number;
    startBufferedId?: string;
    startNoBuffer: number;
    endBuffered: number;
    endNoBuffer: number;
    firstFullyOnScreenIndex: number;
    idsInView: string[];
    scrollPending: number;
    scroll: number;
    scrollTime: number;
    scrollPrev: number;
    scrollPrevTime: number;
    scrollAdjustHandler: ScrollAdjustHandler;
    maintainingScrollAtEnd?: boolean;
    totalSize: number;
    otherAxisSize?: number;
    timeouts: Set<number>;
    timeoutSizeMessage: any;
    nativeMarginTop: number;
    indexByKey: Map<string, number>;
    idCache: Map<number, string>;
    viewabilityConfigCallbackPairs: ViewabilityConfigCallbackPairs<any> | undefined;
    scrollHistory: Array<{ scroll: number; time: number }>;
    startReachedBlockedByTimer: boolean;
    endReachedBlockedByTimer: boolean;
    scrollForNextCalculateItemsInView: { top: number; bottom: number } | undefined;
    enableScrollForNextCalculateItemsInView: boolean;
    minIndexSizeChanged: number | undefined;
    queuedInitialLayout?: boolean | undefined;
    queuedCalculateItemsInView: number | undefined;
    lastBatchingAction: number;
    ignoreScrollFromMVCP?: { lt?: number; gt?: number };
    ignoreScrollFromMVCPTimeout?: any;
    scrollingTo?:
        | { offset: number; index?: number; viewOffset?: number; viewPosition?: number; animated?: boolean }
        | undefined;
    needsOtherAxisSize?: boolean;
    averageSizes: Record<
        string,
        {
            num: number;
            avg: number;
        }
    >;
    refScroller: React.RefObject<ScrollView>;
    loadStartTime: number;
    initialScroll: ScrollIndexWithOffset | undefined;
    lastLayout: LayoutRectangle | undefined;
    timeoutSetPaddingTop?: any;
    activeStickyIndex: number | undefined;
    stickyContainers: Map<number, number>;
    stickyContainerPool: Set<number>;
    scrollProcessingEnabled: boolean;
    props: {
        alignItemsAtEnd: boolean;
        data: readonly any[];
        estimatedItemSize: number | undefined;
        getEstimatedItemSize: LegendListProps["getEstimatedItemSize"];
        getFixedItemSize: LegendListProps["getFixedItemSize"];
        getItemType: LegendListProps["getItemType"];
        horizontal: boolean;
        keyExtractor: LegendListProps["keyExtractor"];
        maintainScrollAtEnd: boolean | MaintainScrollAtEndOptions;
        maintainScrollAtEndThreshold: number | undefined;
        maintainVisibleContentPosition: boolean;
        onEndReached: LegendListProps["onEndReached"];
        onEndReachedThreshold: number | null | undefined;
        onItemSizeChanged: LegendListProps["onItemSizeChanged"];
        onLoad: LegendListProps["onLoad"];
        onScroll: LegendListProps["onScroll"];
        onStartReached: LegendListProps["onStartReached"];
        onStartReachedThreshold: number | null | undefined;
        recycleItems: boolean;
        suggestEstimatedItemSize: boolean;
        stylePaddingBottom: number | undefined;
        renderItem: LegendListProps["renderItem"];
        initialScroll: ScrollIndexWithOffset | undefined;
        scrollBuffer: number;
        numColumns: number;
        initialContainerPoolRatio: number;
        stylePaddingTop: number | undefined;
        snapToIndices: number[] | undefined;
        stickyIndicesSet: Set<number>;
        stickyIndicesArr: number[];
        itemsAreEqual: LegendListProps["itemsAreEqual"];
        enableAverages: boolean;
    };
}

export interface ViewableRange<T> {
    startBuffered: number;
    start: number;
    endBuffered: number;
    end: number;
    items: T[];
}

export interface LegendListRenderItemProps<
    ItemT,
    TItemType extends string | number | undefined = string | number | undefined,
> {
    item: ItemT;
    type: TItemType;
    index: number;
    data: readonly ItemT[];
    extraData: any;
}

export type ScrollState = {
    contentLength: number;
    data: readonly any[];
    end: number;
    endBuffered: number;
    isAtEnd: boolean;
    isAtStart: boolean;
    positionAtIndex: (index: number) => number;
    positions: Map<string, number>;
    scroll: number;
    scrollLength: number;
    sizeAtIndex: (index: number) => number;
    sizes: Map<string, number>;
    start: number;
    startBuffered: number;
};

export type LegendListRef = {
    /**
     * Displays the scroll indicators momentarily.
     */
    flashScrollIndicators(): void;

    /**
     * Returns the native ScrollView component reference.
     */
    getNativeScrollRef(): React.ElementRef<typeof ScrollViewComponent>;

    /**
     * Returns the scroll responder instance for handling scroll events.
     */
    getScrollableNode(): any;

    /**
     * Returns the ScrollResponderMixin for advanced scroll handling.
     */
    getScrollResponder(): ScrollResponderMixin;

    /**
     * Returns the internal state of the scroll virtualization.
     */
    getState(): ScrollState;

    /**
     * Scrolls a specific index into view.
     * @param params - Parameters for scrolling.
     * @param params.animated - If true, animates the scroll. Default: true.
     * @param params.index - The index to scroll to.
     */
    scrollIndexIntoView(params: { animated?: boolean | undefined; index: number }): void;

    /**
     * Scrolls a specific index into view.
     * @param params - Parameters for scrolling.
     * @param params.animated - If true, animates the scroll. Default: true.
     * @param params.item - The item to scroll to.
     */
    scrollItemIntoView(params: { animated?: boolean | undefined; item: any }): void;

    /**
     * Scrolls to the end of the list.
     * @param options - Options for scrolling.
     * @param options.animated - If true, animates the scroll. Default: true.
     * @param options.viewOffset - Offset from the target position.
     */
    scrollToEnd(options?: { animated?: boolean | undefined; viewOffset?: number | undefined }): void;

    /**
     * Scrolls to a specific index in the list.
     * @param params - Parameters for scrolling.
     * @param params.animated - If true, animates the scroll. Default: true.
     * @param params.index - The index to scroll to.
     * @param params.viewOffset - Offset from the target position.
     * @param params.viewPosition - Position of the item in the viewport (0 to 1).
     */
    scrollToIndex(params: {
        animated?: boolean | undefined;
        index: number;
        viewOffset?: number | undefined;
        viewPosition?: number | undefined;
    }): void;

    /**
     * Scrolls to a specific item in the list.
     * @param params - Parameters for scrolling.
     * @param params.animated - If true, animates the scroll. Default: true.
     * @param params.item - The item to scroll to.
     * @param params.viewOffset - Offset from the target position.
     * @param params.viewPosition - Position of the item in the viewport (0 to 1).
     */
    scrollToItem(params: {
        animated?: boolean | undefined;
        item: any;
        viewOffset?: number | undefined;
        viewPosition?: number | undefined;
    }): void;

    /**
     * Scrolls to a specific offset in pixels.
     * @param params - Parameters for scrolling.
     * @param params.offset - The pixel offset to scroll to.
     * @param params.animated - If true, animates the scroll. Default: true.
     */
    scrollToOffset(params: { offset: number; animated?: boolean | undefined }): void;

    /**
     * Sets or adds to the offset of the visible content anchor.
     * @param value - The offset to set or add.
     * @param animated - If true, uses Animated to animate the change.
     */
    setVisibleContentAnchorOffset(value: number | ((value: number) => number)): void;

    /**
     * Sets whether scroll processing is enabled.
     * @param enabled - If true, scroll processing is enabled.
     */
    setScrollProcessingEnabled(enabled: boolean): void;
};

export interface ViewToken<ItemT = any> {
    item: ItemT;
    key: string;
    index: number;
    isViewable: boolean;
    containerId: number;
}

export interface ViewAmountToken<ItemT = any> extends ViewToken<ItemT> {
    sizeVisible: number;
    size: number;
    percentVisible: number;
    percentOfScroller: number;
    scrollSize: number;
}

export interface ViewabilityConfigCallbackPair<ItemT> {
    viewabilityConfig: ViewabilityConfig;
    onViewableItemsChanged?: OnViewableItemsChanged<ItemT>;
}

export type ViewabilityConfigCallbackPairs<ItemT> = ViewabilityConfigCallbackPair<ItemT>[];

export type OnViewableItemsChanged<ItemT> =
    | ((info: { viewableItems: Array<ViewToken<ItemT>>; changed: Array<ViewToken<ItemT>> }) => void)
    | null;

export interface ViewabilityConfig {
    /**
     * A unique ID to identify this viewability config
     */
    id?: string;

    /**
     * Minimum amount of time (in milliseconds) that an item must be physically viewable before the
     * viewability callback will be fired. A high number means that scrolling through content without
     * stopping will not mark the content as viewable.
     */
    minimumViewTime?: number | undefined;

    /**
     * Percent of viewport that must be covered for a partially occluded item to count as
     * "viewable", 0-100. Fully visible items are always considered viewable. A value of 0 means
     * that a single pixel in the viewport makes the item viewable, and a value of 100 means that
     * an item must be either entirely visible or cover the entire viewport to count as viewable.
     */
    viewAreaCoveragePercentThreshold?: number | undefined;

    /**
     * Similar to `viewAreaCoveragePercentThreshold`, but considers the percent of the item that is visible,
     * rather than the fraction of the viewable area it covers.
     */
    itemVisiblePercentThreshold?: number | undefined;

    /**
     * Nothing is considered viewable until the user scrolls or `recordInteraction` is called after
     * render.
     */
    waitForInteraction?: boolean | undefined;
}

export type ViewabilityCallback<ItemT = any> = (viewToken: ViewToken<ItemT>) => void;
export type ViewabilityAmountCallback<ItemT = any> = (viewToken: ViewAmountToken<ItemT>) => void;

export interface LegendListRecyclingState<T> {
    item: T;
    prevItem: T | undefined;
    index: number;
    prevIndex: number | undefined;
}

// biome-ignore lint/complexity/noBannedTypes: This is correct
export type TypedForwardRef = <T, P = {}>(
    render: (props: P, ref: React.Ref<T>) => React.ReactNode,
) => (props: P & React.RefAttributes<T>) => React.ReactNode;

export const typedForwardRef = forwardRef as TypedForwardRef;

export type TypedMemo = <T extends React.ComponentType<any>>(
    Component: T,
    propsAreEqual?: (
        prevProps: Readonly<React.JSXElementConstructor<T>>,
        nextProps: Readonly<React.JSXElementConstructor<T>>,
    ) => boolean,
) => T & { displayName?: string };

export const typedMemo = memo as TypedMemo;

export interface ScrollIndexWithOffset {
    index: number;
    viewOffset: number;
}

export interface ScrollIndexWithOffsetPosition extends ScrollIndexWithOffset {
    viewPosition: number;
}

export type GetRenderedItemResult<ItemT> = { index: number; item: ItemT; renderedItem: React.ReactNode };
export type GetRenderedItem = (key: string) => GetRenderedItemResult<any> | null;
