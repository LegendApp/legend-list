// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments

import type { ForwardedRef } from "react";
import * as React from "react";
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { Dimensions, type LayoutRectangle, type ScrollView } from "react-native";

import { Containers } from "@/components/Containers";
import { IsNewArchitecture } from "@/constants";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import { checkResetContainers } from "@/core/checkResetContainers";
import { doInitialAllocateContainers } from "@/core/doInitialAllocateContainers";
import { handleLayout } from "@/core/handleLayout";
import { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import { scrollToIndex } from "@/core/scrollToIndex";
import { updateItemPositions } from "@/core/updateItemPositions";
import { updateItemSize } from "@/core/updateItemSize";
import { useWrapIfItem } from "@/core/useWrapIfItem";
import { setupViewability } from "@/core/viewability";
import { type StateContext, StateProvider, set$, useStateContext } from "@/state/state";
import type { DatasetEntry, InternalState, LegendListDatasetsProps, ScrollIndexWithOffset } from "@/types";
import { typedForwardRef, typedMemo } from "@/types";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { checkAtTop } from "@/utils/checkAtTop";
import { createColumnWrapperStyle } from "@/utils/createColumnWrapperStyle";
import { getId } from "@/utils/getId";
import { getRenderedItem } from "@/utils/getRenderedItem";
import { setPaddingTop } from "@/utils/setPaddingTop";
import { updateSnapToOffsets } from "@/utils/updateSnapToOffsets";

const DEFAULT_DRAW_DISTANCE = 250;
const DEFAULT_ITEM_SIZE = 100;

// React.Activity is stable in React 19 but may not be in @types/react yet
const Activity = (React as any).Activity as React.ComponentType<{
    mode: "visible" | "hidden";
    children: React.ReactNode;
}>;

export interface DatasetLayerHandle {
    /** Route a scroll offset to this dataset (only called for active dataset) */
    onScrollOffset: (offset: number) => void;
    /** Propagate viewport layout from the parent ScrollView */
    setViewportLayout: (layout: LayoutRectangle) => void;
    /** Propagate the shared header size to this dataset's ctx */
    setHeaderSize: (size: number) => void;
    /** Called when this dataset switches from inactive → active */
    activate: (scrollOffset: number) => void;
    /** Access to the StateContext for ref delegation */
    getCtx: () => StateContext;
    /** Access to the InternalState for ref delegation */
    getState: () => InternalState;
}

// Props for the inner headless layer — shared props from LegendListDatasetsProps
// plus the per-dataset data/dataVersion and the parent scroll ref.
// Note: dataVersion here is the PER-DATASET version from DatasetEntry, not the
// shared prop — this prevents a shared bump from rebuilding all datasets at once.
export type DatasetLayerProps<T> = Omit<
    LegendListDatasetsProps<T>,
    | "datasets"
    | "dataVersion"
    | "ListHeaderComponent"
    | "ListHeaderComponentStyle"
    | "ListFooterComponent"
    | "ListFooterComponentStyle"
    | "onLayout"
    | "refScrollView"
    | "style"
> & {
    data: ReadonlyArray<T>;
    dataVersion?: DatasetEntry<T>["dataVersion"];
    refScroller: React.RefObject<ScrollView>;
};

const DatasetLayerInner = typedForwardRef(function DatasetLayerInner<T>(
    props: DatasetLayerProps<T>,
    ref: ForwardedRef<DatasetLayerHandle>,
) {
    const {
        alignItemsAtEnd = false,
        columnWrapperStyle,
        contentContainerStyle: contentContainerStyleProp,
        data: dataProp = [],
        dataVersion,
        drawDistance = DEFAULT_DRAW_DISTANCE,
        enableAverages = true,
        estimatedItemSize: estimatedItemSizeProp,
        estimatedListSize,
        extraData,
        getEstimatedItemSize,
        getFixedItemSize,
        getItemType,
        horizontal,
        initialContainerPoolRatio = 2,
        initialHeaderSize,
        initialScrollIndex: initialScrollIndexProp,
        initialScrollOffset: initialScrollOffsetProp,
        itemsAreEqual,
        keyExtractor: keyExtractorProp,
        maintainScrollAtEnd = false,
        maintainScrollAtEndThreshold = 0.1,
        maintainVisibleContentPosition = true,
        numColumns: numColumnsProp = 1,
        onEndReached,
        onEndReachedThreshold = 0.5,
        onItemSizeChanged,
        onLoad,
        onStartReached,
        onStartReachedThreshold = 0.5,
        onStickyHeaderChange,
        onViewableItemsChanged,
        recycleItems = false,
        refScroller,
        renderItem,
        snapToIndices,
        stickyIndices,
        suggestEstimatedItemSize,
        viewabilityConfig,
        viewabilityConfigCallbackPairs,
        waitForInitialLayout,
        stickyHeaderConfig,
        ItemSeparatorComponent,
    } = props;

    // Build initialScroll the same way LegendListInner does
    const initialScroll: ScrollIndexWithOffset | undefined =
        initialScrollIndexProp || initialScrollOffsetProp
            ? typeof initialScrollIndexProp === "object"
                ? { index: initialScrollIndexProp.index || 0, viewOffset: initialScrollIndexProp.viewOffset || 0 }
                : { index: initialScrollIndexProp || 0, viewOffset: initialScrollOffsetProp || 0 }
            : undefined;

    // Track whether we've applied the initial scroll for this dataset
    const hasAppliedInitialScrollRef = useRef(false);

    const ctx = useStateContext();
    if (initialHeaderSize !== undefined && !ctx.internalState) {
        ctx.values.set("headerSize", initialHeaderSize);
    }
    ctx.columnWrapperStyle =
        columnWrapperStyle ||
        (contentContainerStyleProp ? createColumnWrapperStyle(contentContainerStyleProp as any) : undefined);

    const estimatedItemSize = estimatedItemSizeProp ?? DEFAULT_ITEM_SIZE;
    const scrollBuffer = (drawDistance ?? DEFAULT_DRAW_DISTANCE) || 1;
    const keyExtractor = keyExtractorProp ?? ((_item: any, index: number) => index.toString());

    const refState = useRef<InternalState>();

    if (!refState.current) {
        if (!ctx.internalState) {
            const initialScrollLength = (estimatedListSize ??
                (IsNewArchitecture ? { height: 0, width: 0 } : Dimensions.get("window")))[
                horizontal ? "width" : "height"
            ];

            ctx.internalState = {
                activeStickyIndex: undefined,
                averageSizes: {},
                columns: new Map(),
                containerItemKeys: new Set(),
                containerItemTypes: new Map(),
                dataChangeNeedsScrollUpdate: false,
                enableScrollForNextCalculateItemsInView: true,
                endBuffered: -1,
                endNoBuffer: -1,
                endReachedBlockedByTimer: false,
                firstFullyOnScreenIndex: -1,
                idCache: [],
                idsInView: [],
                indexByKey: new Map(),
                initialScroll,
                isAtEnd: false,
                isAtStart: false,
                isEndReached: false,
                isStartReached: false,
                lastBatchingAction: Date.now(),
                lastLayout: undefined,
                loadStartTime: Date.now(),
                minIndexSizeChanged: 0,
                nativeMarginTop: 0,
                positions: new Map(),
                props: {} as any,
                queuedCalculateItemsInView: 0,
                refScroller: undefined as any,
                scroll: 0,
                scrollAdjustHandler: new ScrollAdjustHandler(ctx),
                scrollForNextCalculateItemsInView: undefined,
                scrollHistory: [],
                scrollLength: initialScrollLength,
                scrollPending: 0,
                scrollPrev: 0,
                scrollPrevTime: 0,
                scrollProcessingEnabled: true,
                scrollTime: 0,
                sizes: new Map(),
                sizesKnown: new Map(),
                startBuffered: -1,
                startNoBuffer: -1,
                startReachedBlockedByTimer: false,
                stickyContainerPool: new Set(),
                stickyContainers: new Map(),
                timeoutSizeMessage: 0,
                timeouts: new Set(),
                totalSize: 0,
                viewabilityConfigCallbackPairs: undefined as never,
            };

            set$(ctx, "maintainVisibleContentPosition", maintainVisibleContentPosition);
            set$(ctx, "extraData", extraData);
        }
        refState.current = ctx.internalState;
    }

    const state = refState.current!;
    const isFirst = !state.props.renderItem;

    const didDataChange = state.props.dataVersion !== dataVersion || state.props.data !== dataProp;
    if (didDataChange) {
        state.dataChangeNeedsScrollUpdate = true;
    }

    // Keep initialScroll in sync with props so calculateItemsInView uses it correctly
    state.initialScroll = initialScroll;

    state.props = {
        alignItemsAtEnd,
        data: dataProp,
        dataVersion,
        enableAverages,
        estimatedItemSize,
        getEstimatedItemSize: useWrapIfItem(getEstimatedItemSize),
        getFixedItemSize: useWrapIfItem(getFixedItemSize),
        getItemType: useWrapIfItem(getItemType),
        horizontal: !!horizontal,
        initialContainerPoolRatio,
        initialScroll,
        itemsAreEqual,
        keyExtractor: useWrapIfItem(keyExtractor),
        maintainScrollAtEnd,
        maintainScrollAtEndThreshold,
        maintainVisibleContentPosition,
        numColumns: numColumnsProp,
        onEndReached,
        onEndReachedThreshold,
        onItemSizeChanged,
        onLoad,
        onScroll: undefined,
        onStartReached,
        onStartReachedThreshold,
        onStickyHeaderChange,
        recycleItems: !!recycleItems,
        renderItem: renderItem!,
        scrollBuffer,
        snapToIndices,
        stickyIndicesArr: stickyIndices ?? [],
        stickyIndicesSet: useMemo(() => new Set(stickyIndices ?? []), [stickyIndices?.join(",")]),
        stylePaddingBottom: 0,
        stylePaddingTop: 0,
        suggestEstimatedItemSize: !!suggestEstimatedItemSize,
    };

    state.refScroller = refScroller;

    const memoizedLastItemKeys = useMemo(() => {
        if (!dataProp.length) return [];
        return Array.from({ length: Math.min(numColumnsProp, dataProp.length) }, (_, i) =>
            getId(state, dataProp.length - 1 - i),
        );
    }, [dataProp, dataVersion, numColumnsProp]);

    const initializeStateVars = useCallback(() => {
        set$(ctx, "lastItemKeys", memoizedLastItemKeys);
        set$(ctx, "numColumns", numColumnsProp);
        setPaddingTop(ctx, state, { stylePaddingTop: 0 });
    }, [memoizedLastItemKeys, numColumnsProp]);

    if (isFirst) {
        initializeStateVars();
        updateItemPositions(ctx, state, /*dataChanged*/ true);
    }

    useLayoutEffect(() => {
        const didAllocateContainers = dataProp.length > 0 && doInitialAllocateContainers(ctx, state);
        if (!didAllocateContainers) {
            checkResetContainers(ctx, state, isFirst, dataProp);
        }
    }, [dataProp, dataVersion, numColumnsProp]);

    useLayoutEffect(() => {
        if (snapToIndices) {
            updateSnapToOffsets(ctx, state);
        }
    }, [snapToIndices]);

    useLayoutEffect(() => {
        set$(ctx, "extraData", extraData);
    }, [extraData]);

    useLayoutEffect(initializeStateVars, [dataVersion, memoizedLastItemKeys.join(","), numColumnsProp]);

    useEffect(() => {
        const viewability = setupViewability({
            onViewableItemsChanged,
            viewabilityConfig,
            viewabilityConfigCallbackPairs,
        });
        state.viewabilityConfigCallbackPairs = viewability;
        state.enableScrollForNextCalculateItemsInView = !viewability;
    }, [viewabilityConfig, viewabilityConfigCallbackPairs, onViewableItemsChanged]);

    useImperativeHandle(
        ref,
        () => ({
            activate(scrollOffset: number) {
                // Apply initialScroll the first time this dataset becomes active
                if (initialScroll && !hasAppliedInitialScrollRef.current) {
                    hasAppliedInitialScrollRef.current = true;
                    scrollToIndex(ctx, state, {
                        animated: false,
                        index: initialScroll.index,
                        viewOffset: initialScroll.viewOffset,
                    });
                } else {
                    state.scroll = scrollOffset;
                }
                state.dataChangeNeedsScrollUpdate = true;
                state.scrollForNextCalculateItemsInView = undefined;
                calculateItemsInView(ctx, state, { dataChanged: false, doMVCP: false });
            },
            getCtx() {
                return ctx;
            },
            getState() {
                return state;
            },
            onScrollOffset(offset: number) {
                state.scroll = offset;
                state.lastBatchingAction = Date.now();
                state.dataChangeNeedsScrollUpdate = false;
                calculateItemsInView(ctx, state);
                checkAtBottom(ctx, state);
                checkAtTop(state);
            },
            setHeaderSize(size: number) {
                set$(ctx, "headerSize", size);
            },
            setViewportLayout(layout: LayoutRectangle) {
                handleLayout(ctx, state, layout, () => {});
            },
        }),
        [],
    );

    const fns = useMemo(
        () => ({
            getRenderedItem: (key: string) => getRenderedItem(ctx, state, key),
            updateItemSize: (itemKey: string, sizeObj: { width: number; height: number }) =>
                updateItemSize(ctx, state, itemKey, sizeObj),
        }),
        [],
    );

    return (
        <Containers
            getRenderedItem={fns.getRenderedItem}
            horizontal={!!horizontal}
            ItemSeparatorComponent={ItemSeparatorComponent}
            recycleItems={!!recycleItems}
            stickyHeaderConfig={stickyHeaderConfig}
            updateItemSize={fns.updateItemSize}
            waitForInitialLayout={waitForInitialLayout}
        />
    );
});

// Memoized so that when LegendListDatasets re-renders (e.g. because the active
// dataset's data changed), sibling DatasetLayers whose data and active flag
// haven't changed are skipped entirely.
export const DatasetLayer = typedMemo(
    typedForwardRef(function DatasetLayer<T>(
        props: DatasetLayerProps<T> & { active: boolean },
        ref: ForwardedRef<DatasetLayerHandle>,
    ) {
        const { active, ...rest } = props;
        return (
            <StateProvider>
                <Activity mode={active ? "visible" : "hidden"}>
                    <DatasetLayerInner ref={ref} {...(rest as DatasetLayerProps<T>)} />
                </Activity>
            </StateProvider>
        );
    }),
);
