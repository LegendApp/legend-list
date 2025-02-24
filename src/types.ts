import type { ComponentProps, ReactNode } from "react";
import type { ScrollResponderMixin, ScrollViewComponent, ScrollViewProps } from "react-native";
import type { ScrollView, StyleProp, ViewStyle } from "react-native";
import type Animated from "react-native-reanimated";
import type { ScrollAdjustHandler } from "./ScrollAdjustHandler";

export type LegendListPropsBase<
    ItemT,
    TScrollView extends ComponentProps<typeof ScrollView> | ComponentProps<typeof Animated.ScrollView>,
> = Omit<TScrollView, "contentOffset" | "contentInset" | "maintainVisibleContentPosition" | "stickyHeaderIndices"> & {
    data: ReadonlyArray<ItemT>;
    initialScrollOffset?: number;
    initialScrollIndex?: number;
    drawDistance?: number;
    recycleItems?: boolean;
    onEndReachedThreshold?: number | null | undefined;
    onStartReachedThreshold?: number | null | undefined;
    maintainScrollAtEnd?: boolean;
    maintainScrollAtEndThreshold?: number;
    alignItemsAtEnd?: boolean;
    maintainVisibleContentPosition?: boolean;
    numColumns?: number;
    refScrollView?: React.Ref<ScrollView>;
    waitForInitialLayout?: boolean;
    // in most cases providing a constant value for item size enough
    estimatedItemSize?: number;
    // in case you have distinct item sizes, you can provide a function to get the size of an item
    // use instead of FlatList's getItemLayout or FlashList overrideItemLayout
    // if you want to have accurate initialScrollOffset, you should provide this function
    getEstimatedItemSize?: (index: number, item: ItemT) => number;
    onStartReached?: ((info: { distanceFromStart: number }) => void) | null | undefined;
    onEndReached?: ((info: { distanceFromEnd: number }) => void) | null | undefined;
    keyExtractor?: (item: ItemT, index: number) => string;
    renderItem?: (props: LegendListRenderItemProps<ItemT>) => ReactNode;
    ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;
    ListHeaderComponentStyle?: StyleProp<ViewStyle> | undefined;
    ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;
    ListFooterComponentStyle?: StyleProp<ViewStyle> | undefined;
    ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;
    ItemSeparatorComponent?: React.ComponentType<any>;
    viewabilityConfigCallbackPairs?: ViewabilityConfigCallbackPairs | undefined;
    viewabilityConfig?: ViewabilityConfig;
    onViewableItemsChanged?: OnViewableItemsChanged | undefined;
    onItemSizeChanged?: (info: {
        size: number;
        previous: number;
        index: number;
        itemKey: string;
        itemData: ItemT;
    }) => void;
    /**
     * Render custom ScrollView component.
     * @default (props) => <ScrollView {...props} />
     */
    renderScrollComponent?: (props: ScrollViewProps) => React.ReactElement<ScrollViewProps>;
    extraData?: any;
};

export type AnchoredPosition = {
    type: "top" | "bottom";
    relativeCoordinate: number; // used for display
    top: number; // used for calculating the position of the container
};

export type LegendListProps<ItemT> = LegendListPropsBase<ItemT, ComponentProps<typeof ScrollView>>;

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
    sizesLaidOut: Map<string, number> | undefined;
    pendingAdjust: number;
    waitingForMicrotask: any;
    isStartReached: boolean;
    isEndReached: boolean;
    isAtBottom: boolean;
    isAtTop: boolean;
    data: readonly any[];
    idsInFirstRender: Set<string>;
    hasScrolled: boolean;
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
    scrollForNextCalculateItemsInView: { top: number; bottom: number } | undefined;
    enableScrollForNextCalculateItemsInView: boolean;
    minIndexSizeChanged: number | undefined;
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
    useViewability: (configId: string, callback: ViewabilityCallback) => void;
    useViewabilityAmount: (callback: ViewabilityAmountCallback) => void;
    useRecyclingEffect: (effect: (info: LegendListRecyclingState<ItemT>) => void | (() => void)) => void;
    useRecyclingState: <T>(updateState: ((info: LegendListRecyclingState<ItemT>) => T) | T) => [T, React.Dispatch<T>];
}

export type LegendListRef = {
    /**
     * Displays the scroll indicators momentarily.
     */
    flashScrollIndicators(): void;

    getNativeScrollRef(): React.ElementRef<typeof ScrollViewComponent>;

    getScrollResponder(): ScrollResponderMixin;

    getScrollableNode(): any;

    /**
     * A helper function that scrolls to the end of the scrollview;
     * If this is a vertical ScrollView, it scrolls to the bottom.
     * If this is a horizontal ScrollView scrolls to the right.
     *
     * The options object has an animated prop, that enables the scrolling animation or not.
     * The animated prop defaults to true
     */
    scrollToEnd(options?: { animated?: boolean | undefined }): void;

    scrollToIndex: (params: { index: number; animated?: boolean; viewOffset?: number; viewPosition?: number }) => void;

    scrollToItem(params: { animated?: boolean; item: any; viewPosition?: number }): void;

    scrollToOffset(params: { offset: number; animated?: boolean }): void;
};

export interface ViewToken<ItemT = any> {
    item: ItemT;
    key: string;
    index: number;
    isViewable: boolean;
}

export interface ViewAmountToken<ItemT = any> extends ViewToken<ItemT> {
    sizeVisible: number;
    size: number;
    percentVisible: number;
    percentOfScroller: number;
    position: number;
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
