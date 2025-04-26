import { type ComponentProps, type ReactNode, forwardRef, memo } from "react";
import type {
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollResponderMixin,
    ScrollViewComponent,
    ScrollViewProps,
} from "react-native";
import type { ScrollView, StyleProp, ViewStyle } from "react-native";
import type Animated from "react-native-reanimated";
import type { ScrollAdjustHandler } from "./ScrollAdjustHandler";

export type LegendListPropsBase<
    ItemT,
    TScrollView extends ComponentProps<typeof ScrollView> | ComponentProps<typeof Animated.ScrollView>,
> = Omit<
    TScrollView,
    | "contentOffset"
    | "contentInset"
    | "maintainVisibleContentPosition"
    | "stickyHeaderIndices"
    | "removeClippedSubviews"
> & {
    /**
     * If true, aligns items at the end of the list.
     * @default false
     */
    alignItemsAtEnd?: boolean;

    /**
     * Style applied to each column's wrapper view.
     */
    columnWrapperStyle?: ColumnWrapperStyle;

    /**
     * Array of items to render in the list.
     * @required
     */
    data: ReadonlyArray<ItemT>;

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
     * Extra data to trigger re-rendering when changed.
     */
    extraData?: any;

    /**
     * In case you have distinct item sizes, you can provide a function to get the size of an item.
     * Use instead of FlatList's getItemLayout or FlashList overrideItemLayout if you want to have accurate initialScrollOffset, you should provide this function
     */
    getEstimatedItemSize?: (index: number, item: ItemT) => number;

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
    initialScrollIndex?: number;

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
    maintainScrollAtEnd?: boolean;

    /**
     * Distance threshold in percentage of screen size to trigger maintainScrollAtEnd.
     * @default 0.1
     */
    maintainScrollAtEndThreshold?: number;

    /**
     * If true, maintains visibility of content during scroll (e.g., after insertions).
     * @default false
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
    onViewableItemsChanged?: OnViewableItemsChanged | undefined;

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
     * Function to render each item in the list.
     * @required
     */
    renderItem?: (props: LegendListRenderItemProps<ItemT>) => ReactNode;

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
    viewabilityConfigCallbackPairs?: ViewabilityConfigCallbackPairs | undefined;

    /**
     * If true, delays rendering until initial layout is complete.
     * @default false
     */
    waitForInitialLayout?: boolean;
};

export interface ColumnWrapperStyle {
    rowGap?: number;
    gap?: number;
    columnGap?: number;
}

export type AnchoredPosition = {
    type: "top" | "bottom";
    relativeCoordinate: number; // used for display
    top: number; // used for calculating the position of the container
};

export type LegendListProps<ItemT> = LegendListPropsBase<
    ItemT,
    Omit<ComponentProps<typeof ScrollView>, "scrollEventThrottle">
>;

export interface InternalState {
    anchorElement?: {
        id: string;
        coordinate: number;
    };
    belowAnchorElementPositions?: Map<string, number>;
    rowHeights: Map<number, number>;
    positions: Map<string, number>;
    columns: Map<string, number>;
    sizes: Map<string, number>;
    sizesKnown: Map<string, number>;
    pendingAdjust: number;
    isStartReached: boolean;
    isEndReached: boolean;
    isAtBottom: boolean;
    isAtTop: boolean;
    data: readonly any[];
    hasScrolled?: boolean;
    scrollLength: number;
    startBuffered: number;
    startBufferedId?: string;
    startNoBuffer: number;
    endBuffered: number;
    endNoBuffer: number;
    scroll: number;
    scrollTime: number;
    scrollPrev: number;
    scrollPrevTime: number;
    scrollVelocity: number;
    scrollAdjustHandler: ScrollAdjustHandler;
    maintainingScrollAtEnd?: boolean;
    totalSize: number;
    totalSizeBelowAnchor: number;
    timeouts: Set<number>;
    timeoutSizeMessage: any;
    nativeMarginTop: number;
    indexByKey: Map<string, number>;
    viewabilityConfigCallbackPairs: ViewabilityConfigCallbackPairs | undefined;
    renderItem: (props: LegendListRenderItemProps<any>) => ReactNode;
    scrollHistory: Array<{ scroll: number; time: number }>;
    scrollTimer: Timer | undefined;
    startReachedBlockedByTimer: boolean;
    endReachedBlockedByTimer: boolean;
    scrollForNextCalculateItemsInView: { top: number; bottom: number } | undefined;
    enableScrollForNextCalculateItemsInView: boolean;
    minIndexSizeChanged: number | undefined;
    queuedInitialLayout?: boolean | undefined;
    queuedCalculateItemsInView: number | undefined;
    lastBatchingAction: number;
    ignoreScrollFromCalcTotal?: boolean;
    disableScrollJumpsFrom?: number;
    scrollingToOffset?: number | undefined;
    averageSizes: Record<
        string,
        {
            num: number;
            avg: number;
        }
    >;
    onScroll: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | undefined;
}

export interface ViewableRange<T> {
    startBuffered: number;
    start: number;
    endBuffered: number;
    end: number;
    items: T[];
}

export interface LegendListRenderItemProps<ItemT> {
    item: ItemT;
    index: number;
    extraData: any;
}

export type ScrollState = {
    contentLength: number;
    end: number;
    endBuffered: number;
    isAtEnd: boolean;
    isAtStart: boolean;
    scroll: number;
    scrollLength: number;
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
    scrollIndexIntoView(params: {
        animated?: boolean | undefined;
        index: number;
    }): void;

    /**
     * Scrolls a specific index into view.
     * @param params - Parameters for scrolling.
     * @param params.animated - If true, animates the scroll. Default: true.
     * @param params.item - The item to scroll to.
     */
    scrollItemIntoView(params: {
        animated?: boolean | undefined;
        item: any;
    }): void;

    /**
     * Scrolls to the end of the list.
     * @param options - Options for scrolling.
     * @param options.animated - If true, animates the scroll. Default: true.
     */
    scrollToEnd(options?: { animated?: boolean | undefined }): void;

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

export interface ViewabilityConfigCallbackPair {
    viewabilityConfig: ViewabilityConfig;
    onViewableItemsChanged?: OnViewableItemsChanged;
}

export type ViewabilityConfigCallbackPairs = ViewabilityConfigCallbackPair[];

export type OnViewableItemsChanged =
    | ((info: { viewableItems: Array<ViewToken>; changed: Array<ViewToken> }) => void)
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

export type ViewabilityCallback = (viewToken: ViewToken) => void;
export type ViewabilityAmountCallback = (viewToken: ViewAmountToken) => void;

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
    propsAreEqual?: (prevProps: Readonly<ComponentProps<T>>, nextProps: Readonly<ComponentProps<T>>) => boolean,
) => T & { displayName?: string };

export const typedMemo = memo as TypedMemo;
