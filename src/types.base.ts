import type * as React from "react";
import type { Key } from "react";

import type { LegendListListenerType, ListenerTypeValueMap } from "@/state/state";

export interface Insets {
    top: number;
    left: number;
    bottom: number;
    right: number;
}

export interface LayoutRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface NativeScrollEvent {
    contentOffset: { x: number; y: number };
    contentSize: { width: number; height: number };
    layoutMeasurement: { width: number; height: number };
    contentInset: Insets;
    zoomScale: number;
}

export interface NativeSyntheticEvent<T> {
    nativeEvent: T;
}

export type ViewStyle = Record<string, unknown>;
export type StyleProp<T> = T | T[] | null | undefined | false;

// Base ScrollView props with exclusions
export type BaseScrollViewProps<TScrollView> = Omit<
    TScrollView,
    | "contentOffset"
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
        | ((props: LegendListRenderItemProps<ItemT, TItemType>) => React.ReactNode)
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
    children: React.ReactNode;

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
     * Keeps selected items mounted even when they scroll out of view.
     * @default undefined
     */
    alwaysRender?: AlwaysRenderConfig;

    /**
     * Style applied to each column's wrapper view.
     */
    columnWrapperStyle?: ColumnWrapperStyle;

    /**
     * Version token that forces the list to treat data as updated even when the array reference is stable.
     * Increment or change this when mutating the data array in place.
     */
    dataVersion?: Key;

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
     * Optional per-item size estimate used before a row is measured.
     *
     * @deprecated Prefer a single `estimatedItemSize` for initial size hints, or `getFixedItemSize`
     * when item sizes are known exactly.
     */
    getEstimatedItemSize?: (item: ItemT, index: number, type: TItemType) => number;

    /**
     * In case items always have a fixed size, you can provide a function to return it.
     */
    getFixedItemSize?: (item: ItemT, index: number, type: TItemType) => number | undefined;

    /**
     * Returns a stable item type used for pooling and size estimation.
     */
    getItemType?: (item: ItemT, index: number) => TItemType;

    /**
     * Component to render between items, receiving the leading item as prop.
     */
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;

    /**
     * Ratio used to size the initial recycled container pool.
     * @deprecated The list now manages spare container capacity automatically.
     * @default 3
     */
    initialContainerPoolRatio?: number | undefined;

    /**
     * When true, the list initializes scrolled to the last item.
     * Overrides `initialScrollIndex` and `initialScrollOffset` when data is available.
     * @default false
     */
    initialScrollAtEnd?: boolean;

    /**
     * Index to scroll to initially.
     * @default 0
     */
    initialScrollIndex?:
        | number
        | {
              index: number;
              viewOffset?: number | undefined;
              viewPosition?: number | undefined;
          };

    /**
     * Initial scroll position in pixels.
     * @default 0
     */
    initialScrollOffset?: number;

    /**
     * Custom equality function to detect semantically unchanged items.
     */
    itemsAreEqual?: (itemPrevious: ItemT, item: ItemT, index: number, data: readonly ItemT[]) => boolean;

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
     * Use an options object to opt into specific triggers and control whether that scroll is animated.
     * @default false
     */
    maintainScrollAtEnd?: boolean | MaintainScrollAtEndOptions;

    /**
     * Distance threshold in percentage of screen size to trigger maintainScrollAtEnd.
     * @default 0.1
     */
    maintainScrollAtEndThreshold?: number;

    /**
     * Maintains visibility of content.
     * - scroll (default: true) stabilizes during size/layout changes while scrolling.
     * - data (default: false) stabilizes when the data array changes; passing true also sets the RN maintainVisibleContentPosition prop.
     * - shouldRestorePosition can opt out specific items from data-change anchoring.
     * - undefined (default) enables scroll stabilization but skips data-change anchoring.
     * - true enables both behaviors; false disables both.
     */
    maintainVisibleContentPosition?: boolean | MaintainVisibleContentPositionConfig<ItemT>;

    /**
     * Keeps an item visually anchored to the start by adding trailing space when the content below it underflows.
     */
    anchoredEndSpace?: AnchoredEndSpaceConfig;

    /**
     * Adjusts the effective end content inset for web lists without replacing the base contentInset.
     * The adjustment is also rendered as real content padding so the browser scroll range includes it.
     */
    contentInsetEndAdjustment?: number;

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
     * Called after the initial render work completes.
     */
    onLoad?: (info: { elapsedTimeInMs: number }) => void;

    /**
     * Called when list layout metrics change.
     */
    onMetricsChange?: (metrics: LegendListMetrics) => void;

    /**
     * Function to call when the user pulls to refresh.
     */
    onRefresh?: () => void;

    /**
     * Called when the list scrolls.
     */
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
     * Called when the sticky header changes.
     */
    onStickyHeaderChange?: (info: { index: number; item: any }) => void;

    /**
     * Called when the viewability of items changes.
     */
    onViewableItemsChanged?: OnViewableItemsChanged<ItemT> | undefined;

    /**
     * Customize layout for multi-column lists, such as allowing items to span multiple columns.
     */
    overrideItemLayout?: (
        layout: { span?: number },
        item: ItemT,
        index: number,
        maxColumns: number,
        extraData?: any,
    ) => void;

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
    refScrollView?: React.Ref<any>;

    /**
     * If true, shows a refresh indicator.
     * @default false
     */
    refreshing?: boolean;

    /**
     * Render custom ScrollView component.
     * Note: When using `stickyHeaderIndices`, you must provide an Animated ScrollView component.
     * @default (props) => <ScrollView {...props} />
     */
    renderScrollComponent?: (props: any) => React.ReactElement | null;

    /**
     * Array of item indices to use as snap points.
     */
    snapToIndices?: number[];

    /**
     * Configuration for determining item viewability.
     */
    viewabilityConfig?: ViewabilityConfig;

    /**
     * Pairs of viewability configs and their callbacks for tracking visibility.
     */
    viewabilityConfigCallbackPairs?: ViewabilityConfigCallbackPairs<ItemT> | undefined;

    /**
     * Array of child indices determining which children get docked to the top of the screen when scrolling.
     * For example, passing stickyHeaderIndices={[0]} will cause the first child to be fixed to the top of the scroll view.
     * Not supported in conjunction with horizontal={true}.
     * @default undefined
     */
    stickyHeaderIndices?: number[];

    /**
     * @deprecated Use stickyHeaderIndices instead for parity with React Native.
     */
    stickyIndices?: number[];

    /**
     * Configuration for sticky headers.
     * @default undefined
     */
    stickyHeaderConfig?: StickyHeaderConfig;

    /**
     * Web only: when true, listens to window/body scrolling instead of rendering a scrollable list container.
     * @default false
     */
    useWindowScroll?: boolean;
}

// Clean final type composition
export type LegendListPropsBase<
    ItemT,
    TScrollViewProps = Record<string, any>,
    TItemType extends string | undefined = string | undefined,
> = BaseScrollViewProps<TScrollViewProps> &
    LegendListSpecificProps<ItemT, TItemType> &
    (DataModeProps<ItemT, TItemType> | ChildrenModeProps);

export interface MaintainVisibleContentPositionConfig<ItemT = any> {
    data?: boolean;
    size?: boolean;
    shouldRestorePosition?: (item: ItemT, index: number, data: readonly ItemT[]) => boolean;
}

export interface AnchoredEndSpaceConfig {
    anchorIndex: number;
    anchorOffset?: number;
    anchorMaxSize?: number;
    includeInEndInset?: boolean;
    onSizeChanged?: (size: number) => void;
}

export interface StickyHeaderConfig {
    /**
     * Specifies how far from the top edge sticky headers should start sticking.
     * Useful for scenarios with a fixed navbar or header, where sticky elements pin below it..
     * @default 0
     */
    offset?: number;

    /**
     * Component to render as a backdrop behind the sticky header.
     * @default undefined
     */
    backdropComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;
}

export interface AlwaysRenderConfig {
    top?: number;
    bottom?: number;
    indices?: number[];
    keys?: string[];
}

export interface MaintainScrollAtEndOnOptions {
    dataChange?: boolean;
    itemLayout?: boolean;
    layout?: boolean;
}

export interface MaintainScrollAtEndOptions {
    /**
     * Whether maintainScrollAtEnd should animate when it scrolls to the end.
     */
    animated?: boolean;
    /**
     * Which events should keep the list pinned to the end.
     * - If omitted, object values default to all triggers.
     * - If provided, only the keys set to `true` are enabled.
     */
    on?: MaintainScrollAtEndOnOptions;
}

export type ColumnWrapperStyle = {
    rowGap?: number;
    gap?: number;
    columnGap?: number;
} & Omit<ViewStyle, "gap" | "rowGap" | "columnGap">;

export interface LegendListMetrics {
    headerSize: number;
    footerSize: number;
}

export interface LegendListAverageItemSize {
    average: number;
    count: number;
}

export interface LegendListRenderItemProps<
    ItemT,
    TItemType extends string | number | undefined = string | number | undefined,
> {
    data: readonly ItemT[];
    extraData: any;
    index: number;
    item: ItemT;
    type: TItemType;
}

export type LegendListState = {
    activeStickyIndex: number;
    contentLength: number;
    data: readonly any[];
    elementAtIndex: (index: number) => any;
    end: number;
    endBuffered: number;
    isAtEnd: boolean;
    isAtStart: boolean;
    isNearEnd: boolean;
    isNearStart: boolean;
    isEndReached: boolean;
    isStartReached: boolean;
    isWithinMaintainScrollAtEndThreshold: boolean;
    getAverageItemSizes: () => Record<string, LegendListAverageItemSize>;
    listen: <T extends LegendListListenerType>(
        listenerType: T,
        callback: (value: ListenerTypeValueMap[T]) => void,
    ) => () => void;
    listenToPosition: (key: string, callback: (value: number) => void) => () => void;
    positionAtIndex: (index: number) => number;
    positionByKey: (key: string) => number | undefined;
    scroll: number;
    scrollLength: number;
    scrollVelocity: number;
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
    getNativeScrollRef(): any;

    /**
     * Returns the scroll responder instance for handling scroll events.
     */
    getScrollableNode(): any;

    /**
     * Returns the ScrollResponderMixin for advanced scroll handling.
     */
    getScrollResponder(): any;

    /**
     * Returns the internal state of the scroll virtualization.
     */
    getState(): LegendListState;

    /**
     * Scrolls a specific index into view.
     * @param params - Parameters for scrolling.
     * @param params.animated - If true, animates the scroll. Default: true.
     * @param params.index - The index to scroll to.
     */
    scrollIndexIntoView(params: { animated?: boolean | undefined; index: number }): Promise<void>;

    /**
     * Scrolls a specific index into view.
     * @param params - Parameters for scrolling.
     * @param params.animated - If true, animates the scroll. Default: true.
     * @param params.item - The item to scroll to.
     */
    scrollItemIntoView(params: { animated?: boolean | undefined; item: any }): Promise<void>;

    /**
     * Scrolls to the end of the list.
     * @param options - Options for scrolling.
     * @param options.animated - If true, animates the scroll. Default: true.
     * @param options.viewOffset - Offset from the target position.
     */
    scrollToEnd(options?: { animated?: boolean | undefined; viewOffset?: number | undefined }): Promise<void>;

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
    }): Promise<void>;

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
    }): Promise<void>;

    /**
     * Scrolls to a specific offset in pixels.
     * @param params - Parameters for scrolling.
     * @param params.offset - The pixel offset to scroll to.
     * @param params.animated - If true, animates the scroll. Default: true.
     */
    scrollToOffset(params: { offset: number; animated?: boolean | undefined }): Promise<void>;

    /**
     * Sets or adds to the offset of the visible content anchor.
     * @param value - The offset to set or add.
     * @param animated - If true, uses Animated to animate the change.
     */
    setVisibleContentAnchorOffset(value: number | ((val: number) => number)): void;

    /**
     * Sets whether scroll processing is enabled.
     * @param enabled - If true, scroll processing is enabled.
     */
    setScrollProcessingEnabled(enabled: boolean): void;

    /**
     * Clears internal virtualization caches.
     * @param options - Cache clearing options.
     * @param options.mode - `sizes` clears measurement caches. `full` also clears key/position caches.
     */
    clearCaches(options?: { mode?: "sizes" | "full" }): void;

    /**
     * Reports an externally measured content inset. Pass null/undefined to clear.
     * Values are merged on top of props/animated/native insets.
     */
    reportContentInset(inset?: Partial<Insets> | null): void;
};

export interface ViewToken<ItemT = any> {
    containerId: number;
    index: number;
    isViewable: boolean;
    item: ItemT;
    key: string;
}

export interface ViewAmountToken<ItemT = any> extends ViewToken<ItemT> {
    percentOfScroller: number;
    percentVisible: number;
    scrollSize: number;
    size: number;
    sizeVisible: number;
}

export interface ViewabilityConfigCallbackPair<ItemT = any> {
    onViewableItemsChanged?: OnViewableItemsChanged<ItemT>;
    viewabilityConfig: ViewabilityConfig;
}

export type ViewabilityConfigCallbackPairs<ItemT> = ViewabilityConfigCallbackPair<ItemT>[];

export interface OnViewableItemsChangedInfo<ItemT> {
    changed: Array<ViewToken<ItemT>>;
    end: number;
    endBuffered: number;
    start: number;
    startBuffered: number;
    viewableItems: Array<ViewToken<ItemT>>;
}

export type OnViewableItemsChanged<ItemT> = ((info: OnViewableItemsChangedInfo<ItemT>) => void) | null;

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
    index: number;
    item: T;
    prevIndex: number | undefined;
    prevItem: T | undefined;
}

export interface ScrollIndexWithOffset {
    index: number;
    viewOffset?: number;
    viewPosition?: number;
}

export interface ScrollIndexWithOffsetPosition extends ScrollIndexWithOffset {
    viewPosition?: number;
}

export interface ScrollIndexWithOffsetAndContentOffset extends ScrollIndexWithOffsetPosition {
    contentOffset?: number;
}

/** @deprecated Kept for backwards compatibility. Use `ScrollIndexWithOffsetPosition`. */
export interface InitialScrollAnchor extends ScrollIndexWithOffsetPosition {
    attempts?: number;
    lastDelta?: number;
    settledTicks?: number;
}
