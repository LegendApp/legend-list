import type { Key } from "react";
import * as React from "react";

import type { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import type {
    AlwaysRenderConfig,
    AnchoredEndSpaceConfig,
    Insets,
    LayoutRectangle,
    LegendListPropsBase,
    LegendListRenderItemProps,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollIndexWithOffsetAndContentOffset,
    ViewabilityConfigCallbackPairs,
} from "@/types.base";
import type { StylesAsSharedValue } from "@/typesInternal";

export type { BaseScrollViewProps, LegendListPropsBase } from "@/types.base";

export interface ScrollEventTargetLike {
    addEventListener(type: string, listener: (...args: any[]) => void): void;
    removeEventListener(type: string, listener: (...args: any[]) => void): void;
}

export interface ScrollableNodeLike {
    scrollLeft?: number;
    scrollTop?: number;
}

export interface LegendListScrollerRef {
    flashScrollIndicators(): void;
    getCurrentScrollOffset?(): number;
    getScrollEventTarget?(): ScrollEventTargetLike | null;
    getScrollableNode(): ScrollableNodeLike | null;
    getScrollResponder(): unknown;
    scrollTo(options: { animated?: boolean; x?: number; y?: number }): void;
    scrollToEnd(options?: { animated?: boolean }): void;
}

export interface MaintainVisibleContentPositionNormalized<ItemT = any> {
    data: boolean;
    size: boolean;
    shouldRestorePosition?: (item: ItemT, index: number, data: readonly ItemT[]) => boolean;
}

export interface MaintainScrollAtEndNormalized {
    animated: boolean;
    onLayout: boolean;
    onItemLayout: boolean;
    onDataChange: boolean;
}

export interface ThresholdSnapshot {
    scrollPosition: number;
    contentSize?: number;
    dataLength?: number;
    atThreshold: boolean;
}

export interface ScrollTarget {
    averageSizeSnapshot?: Record<string, number>;
    animated?: boolean;
    index?: number;
    isInitialScroll?: boolean;
    itemSize?: number;
    offset: number;
    precomputedWithViewOffset?: boolean;
    targetOffset?: number;
    viewOffset?: number;
    viewPosition?: number;
}

type BootstrapInitialScrollSession = {
    frameHandle?: number;
    mountFrameCount: number;
    passCount: number;
    previousResolvedOffset?: number;
    scroll: number;
    seedContentOffset: number;
    targetIndexSeed?: number;
    visibleIndices?: readonly number[];
};

type InternalScrollTarget = ScrollTarget & {
    waitForInitialScrollCompletionFrame?: boolean;
};

type InitialScrollSessionCompletion = {
    didDispatchNativeScroll?: boolean;
    didRetrySilentInitialScroll?: boolean;
    watchdog?: {
        startScroll: number;
        targetOffset: number;
    };
};

interface InternalInitialScrollTarget extends ScrollIndexWithOffsetAndContentOffset {
    preserveForBottomPadding?: boolean;
    preserveForFooterLayout?: boolean;
}

type InternalInitialScrollSessionBase = {
    completion?: InitialScrollSessionCompletion;
    previousDataLength: number;
};

type OffsetInitialScrollSession = InternalInitialScrollSessionBase & {
    kind: "offset";
};

type BootstrapOwnedInitialScrollSession = InternalInitialScrollSessionBase & {
    bootstrap?: BootstrapInitialScrollSession;
    kind: "bootstrap";
};

type InternalInitialScrollSession = OffsetInitialScrollSession | BootstrapOwnedInitialScrollSession;

type LegendListPropsInternal = LegendListPropsBase<any, Record<string, any>, string | undefined> & {
    data: readonly any[];
    renderItem: (props: LegendListRenderItemProps<any, string | undefined>) => React.ReactNode;
};

export interface PendingDataComparison {
    byIndex: Array<0 | 1 | 2 | undefined>;
    nextData: readonly unknown[];
    previousData: readonly unknown[];
}

export type AverageSizes = Record<string, { num: number; avg: number }>;

export interface InternalState {
    adjustingFromInitialMount?: number;
    animFrameCheckFinishedScroll?: any;
    anchoredEndSpaceReadyAnchorIndex?: number;
    anchoredEndSpaceReadyAnchorKey?: string;
    averageSizes: AverageSizes;
    columns: Array<number | undefined>;
    columnSpans: Array<number | undefined>;
    containerItemKeys: Map<string, number>;
    containerItemTypes: Map<number, string>;
    dataChangeEpoch: number;
    dataChangeNeedsScrollUpdate: boolean;
    deferredPublicOnScrollEvent?: NativeSyntheticEvent<NativeScrollEvent>;
    didColumnsChange?: boolean;
    didDataChange?: boolean;
    didFinishInitialScroll?: boolean;
    didContainersLayout?: boolean;
    enableScrollForNextCalculateItemsInView: boolean;
    endBuffered: number;
    endNoBuffer: number;
    endReachedSnapshot: ThresholdSnapshot | undefined;
    firstFullyOnScreenIndex: number;
    preservedEndAnchorCorrection?: {
        lastRequestTime?: number;
    };
    hasScrolled?: boolean;
    idCache: string[];
    idsInView: string[];
    ignoreScrollFromMVCP?: { lt?: number; gt?: number };
    ignoreScrollFromMVCPIgnored?: boolean;
    ignoreScrollFromMVCPTimeout?: any;
    indexByKey: Map<string, number>;
    clearPreservedInitialScrollOnNextFinish?: boolean;
    initialScrollSession?: InternalInitialScrollSession;
    initialScroll: InternalInitialScrollTarget | undefined;
    timeoutPreservedInitialScrollClear?: any;
    isEndReached: boolean | null;
    isFirst?: boolean;
    isStartReached: boolean | null;
    lastBatchingAction: number;
    lastLayout: LayoutRectangle | undefined;
    lastNativeScroll?: number;
    lastNativeScrollTime?: number;
    lastScrollAdjustForHistory?: number;
    lastScrollDelta: number;
    loadStartTime: number;
    maintainingScrollAtEnd?: boolean;
    minIndexSizeChanged: number | undefined;
    mvcpAnchorLock?: {
        id: string;
        position: number;
        quietPasses: number;
        expiresAt: number;
    };
    contentInsetOverride?: Partial<Insets> | null;
    nativeContentInset?: Insets;
    nativeMarginTop: number;
    needsOtherAxisSize?: boolean;
    otherAxisSize?: number;
    pendingNativeMVCPAdjust?: {
        amount: number;
        furthestProgressTowardAmount: number;
        manualApplied: number;
        startScroll: number;
    };
    pendingMaintainScrollAtEnd?: boolean;
    pendingDataComparison?: PendingDataComparison;
    pendingTotalSize?: number;
    pendingScrollResolve?: (() => void) | undefined;
    positions: Array<number | undefined>;
    previousData?: readonly unknown[];
    queuedCalculateItemsInView: number | undefined;
    queuedMVCPRecalculate?: number;
    queuedInitialLayout?: boolean | undefined;
    reprocessCurrentScroll?: () => void;
    refScroller: React.RefObject<LegendListScrollerRef | null>;
    scroll: number;
    scrollAdjustHandler: ScrollAdjustHandler;
    scrollForNextCalculateItemsInView: { top: number | null; bottom: number | null } | undefined;
    scrollHistory: Array<{ scroll: number; time: number }>;
    scrollingTo?: InternalScrollTarget | undefined;
    horizontalRTLScrollType?: "normal" | "inverted" | "negative";
    scrollLastCalculate?: number;
    scrollLength: number;
    scrollPending: number;
    scrollPrev: number;
    scrollPrevTime: number;
    scrollProcessingEnabled: boolean;
    scrollTime: number;
    sizes: Map<string, number>;
    sizesKnown: Map<string, number>;
    startBuffered: number;
    startBufferedId?: string;
    startNoBuffer: number;
    startReachedSnapshotDataChangeEpoch: number | undefined;
    startReachedSnapshot: ThresholdSnapshot | undefined;
    stickyContainerPool: Set<number>;
    stickyContainers: Map<number, number>;
    timeouts: Set<number>;
    timeoutSetPaddingTop?: any;
    timeoutCheckFinishedScrollFallback?: any;
    totalSize: number;
    triggerCalculateItemsInView?: (params?: {
        doMVCP?: boolean;
        dataChanged?: boolean;
        forceFullItemPositions?: boolean;
    }) => void;
    userScrollAnchorResetKeys?: Set<string>;
    viewabilityConfigCallbackPairs: ViewabilityConfigCallbackPairs<any> | undefined;
    props: {
        alignItemsAtEnd: boolean;
        animatedProps: StylesAsSharedValue<Record<string, any>>;
        anchoredEndSpace: AnchoredEndSpaceConfig | undefined;
        alwaysRender: AlwaysRenderConfig | undefined;
        alwaysRenderIndicesArr: number[];
        alwaysRenderIndicesSet: Set<number>;
        contentInset: Insets | undefined;
        data: readonly any[];
        dataVersion: Key | undefined;
        drawDistance: number;
        contentInsetEndAdjustment: number | undefined;
        estimatedItemSize: number | undefined;
        getFixedItemSize: LegendListPropsInternal["getFixedItemSize"];
        getItemType: LegendListPropsInternal["getItemType"];
        horizontal: boolean;
        rtl?: boolean;
        itemsAreEqual: LegendListPropsInternal["itemsAreEqual"];
        keyExtractor: LegendListPropsInternal["keyExtractor"];
        maintainScrollAtEnd: MaintainScrollAtEndNormalized | undefined;
        maintainScrollAtEndThreshold: number | undefined;
        maintainVisibleContentPosition: MaintainVisibleContentPositionNormalized;
        numColumns: number;
        onEndReached: LegendListPropsInternal["onEndReached"];
        onEndReachedThreshold: number | null | undefined;
        onItemSizeChanged: LegendListPropsInternal["onItemSizeChanged"];
        onLoad: LegendListPropsInternal["onLoad"];
        onScroll: LegendListPropsInternal["onScroll"];
        onStartReached: LegendListPropsInternal["onStartReached"];
        onStartReachedThreshold: number | null | undefined;
        onStickyHeaderChange: LegendListPropsInternal["onStickyHeaderChange"];
        overrideItemLayout: LegendListPropsInternal["overrideItemLayout"];
        recycleItems: boolean;
        renderItem: LegendListPropsInternal["renderItem"];
        scrollBuffer?: number;
        snapToIndices: number[] | undefined;
        positionComponentInternal: React.ComponentType<any> | undefined;
        stickyPositionComponentInternal: React.ComponentType<any> | undefined;
        stickyHeaderIndicesArr: number[];
        stickyHeaderIndicesSet: Set<number>;
        stylePaddingBottom: number | undefined;
        stylePaddingLeft: number | undefined;
        stylePaddingRight: number | undefined;
        stylePaddingTop: number | undefined;
        useWindowScroll: boolean;
    };
}

export interface ViewableRange<T> {
    end: number;
    endBuffered: number;
    items: T[];
    start: number;
    startBuffered: number;
}

export type GetRenderedItemResult<ItemT> = { index: number; item: ItemT; renderedItem: React.ReactNode };
export type GetRenderedItem = (key: string) => GetRenderedItemResult<any> | null;

// biome-ignore lint/complexity/noBannedTypes: This is correct
export type TypedForwardRef = <T, P = {}>(
    render: (props: P, ref: React.Ref<T>) => React.ReactElement | null,
) => (props: P & React.RefAttributes<T>) => React.ReactElement | null;

export const typedForwardRef = React.forwardRef as TypedForwardRef;

export type TypedMemo = <T extends React.ComponentType<any>>(
    Component: T,
    propsAreEqual?: (
        prevProps: Readonly<React.ComponentProps<T>>,
        nextProps: Readonly<React.ComponentProps<T>>,
    ) => boolean,
) => T & { displayName?: string };

export const typedMemo = React.memo as TypedMemo;
