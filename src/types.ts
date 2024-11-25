import { ComponentProps, ReactNode } from 'react';
import { ScrollView, StyleProp, ViewStyle } from 'react-native';

export type LegendListProps<T> = Omit<ComponentProps<typeof ScrollView>, 'contentOffset'> & {
    data: ArrayLike<any> & T[];
    initialScrollOffset?: number;
    initialScrollIndex?: number;
    drawDistance?: number;
    initialNumContainers?: number;
    recycleItems?: boolean;
    onEndReachedThreshold?: number | null | undefined;
    maintainScrollAtEnd?: boolean;
    maintainScrollAtEndThreshold?: number;
    alignItemsAtEnd?: boolean;
    // in most cases providing a constant value for item size enough
    estimatedItemSize: number;
    // in case you have distinct item sizes, you can provide a function to get the size of an item
    // use instead of FlatList's getItemLayout or FlashList overrideItemLayout
    // if you want to have accurate initialScrollOffset, you should provide this function
    getEstimatedItemSize?: (index: number, item: T) => number;
    onEndReached?: ((info: { distanceFromEnd: number }) => void) | null | undefined;
    keyExtractor?: (item: T, index: number) => string;
    renderItem?: (props: LegendListRenderItemInfo<T>) => ReactNode;
    onViewableRangeChanged?: (range: ViewableRange<T>) => void;
    ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;
    ListHeaderComponentStyle?: StyleProp<ViewStyle> | undefined;
    ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;
    ListFooterComponentStyle?: StyleProp<ViewStyle> | undefined;
    ItemSeparatorComponent?: React.ComponentType<any>;
    //   TODO:
    viewabilityConfigCallbackPairs?: ViewabilityConfigCallbackPairs | undefined;
    viewabilityConfig?: ViewabilityConfig;
    onViewableItemsChanged?: OnViewableItemsChanged | undefined;
};

export interface ViewableRange<T> {
    startBuffered: number;
    start: number;
    endBuffered: number;
    end: number;
    items: T[];
}

export interface LegendListRenderItemInfo<ItemT> {
    item: ItemT;
    index: number;
}

// Internal type after this line
export type StateType =
    | 'numContainers'
    | `containerIndex${number}`
    | `containerPosition${number}`
    | `numItems`
    | 'totalSize'
    | 'paddingTop'
    | 'stylePaddingTop'
    | 'headerSize'
    | 'footerSize';

export interface StateContext {
    listeners: Map<StateType, () => void>;
    values: Map<StateType, any>;
}

export interface InternalState<T = any> {
    positions: Map<string, number>;
    sizes: Map<String, number>;
    pendingAdjust: number;
    animFrameScroll: number | null;
    animFrameLayout: number | null;
    isStartReached: boolean;
    isEndReached: boolean;
    isAtBottom: boolean;
    idsInFirstRender: Set<string>;
    hasScrolled: boolean;
    scrollSize: number;
    startBuffered: number;
    startNoBuffer: number;
    endBuffered: number;
    endNoBuffer: number;
    scrollPrevious: number;
    scroll: number;
    previousViewableItems: Set<number>;
    scrollBuffer: number;
    props: LegendListProps<T>;
    ctx: StateContext;
    timeouts: Set<any>;
    updateViewableItems: ((start: number, end: number) => void) | undefined;
}

export interface ViewToken<ItemT = any> {
    item: ItemT;
    key: string;
    index: number;
    isViewable: boolean;
}

export interface ViewabilityConfigCallbackPair {
    viewabilityConfig: ViewabilityConfig;
    onViewableItemsChanged: OnViewableItemsChanged;
}

export type ViewabilityConfigCallbackPairs = ViewabilityConfigCallbackPair[];

export type OnViewableItemsChanged =
    | ((info: { viewableItems: Array<ViewToken>; changed: Array<ViewToken> }) => void)
    | null;

export interface ViewabilityConfig {
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
