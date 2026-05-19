// DatasetLayerInner — headless per-dataset renderer used by LegendListDatasets.
//
// This is a copy-fork of LegendListInner (src/components/LegendList.tsx). It owns
// per-dataset state (ctx.state, MVCP, viewability, anchored-end, snap, sticky data),
// but does NOT own the ScrollView, scroll handling, layout sync, refScroller, or the
// header/footer — those live in the shared outer (LegendListDatasets).
//
// It renders only <Containers /> (plus per-ctx <ScrollAdjust />), absolutely positioned
// inside the outer ContentArea so that N layers can stack at the same coordinates.

import * as React from "react";
import { type ForwardedRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";

import { Containers } from "@/components/Containers";
import { ScrollAdjust } from "@/components/ScrollAdjust";
import { useDevChecks } from "@/components/useDevChecks";
import { IsNewArchitecture } from "@/constants-platform";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import { checkResetContainers } from "@/core/checkResetContainers";
import { checkStructuralDataChange } from "@/core/checkStructuralDataChange";
import { doInitialAllocateContainers } from "@/core/doInitialAllocateContainers";
import { clearPreservedInitialScrollTarget } from "@/core/finishInitialScroll";
import { handleInitialScrollDataChange } from "@/core/initialScrollLifecycle";
import { resetLayoutCachesForDataChange } from "@/core/resetLayoutCachesForDataChange";
import { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import { maybeUpdateAnchoredEndSpace } from "@/core/updateAnchoredEndSpace";
import { updateContentInsetEndAdjustment } from "@/core/updateContentInsetEndAdjustment";
import { updateItemPositions } from "@/core/updateItemPositions";
import { updateItemSize } from "@/core/updateItemSize";
import { updateScroll } from "@/core/updateScroll";
import { useWrapIfItem } from "@/core/useWrapIfItem";
import { setupViewability } from "@/core/viewability";
import { useInit } from "@/hooks/useInit";
import type { AnimatedValue } from "@/platform/Animated";
import { getWindowSize } from "@/platform/getWindowSize";
import { Platform } from "@/platform/Platform";
import { StyleSheet } from "@/platform/StyleSheet";
import type { LooseScrollViewProps, ViewStyle } from "@/platform/scrollview-types";
import type { StateContext } from "@/state/state";
import { listen$, peek$, set$, useStateContext } from "@/state/state";
import type { LegendListMetrics, LegendListRef, LegendListRenderItemProps, StickyHeaderConfig } from "@/types.base";
import type { InternalState, LegendListPropsBase, LegendListScrollerRef } from "@/types.internal";
import { typedForwardRef } from "@/types.internal";
import type { StylesAsSharedValue } from "@/typesInternal";
import { createColumnWrapperStyle } from "@/utils/createColumnWrapperStyle";
import { createImperativeHandle } from "@/utils/createImperativeHandle";
import { IS_DEV } from "@/utils/devEnvironment";
import { getAlwaysRenderIndices } from "@/utils/getAlwaysRenderIndices";
import { getId } from "@/utils/getId";
import { getRenderedItem } from "@/utils/getRenderedItem";
import { extractPadding, warnDevOnce } from "@/utils/helpers";
import { normalizeMaintainScrollAtEnd } from "@/utils/normalizeMaintainScrollAtEnd";
import { normalizeMaintainVisibleContentPosition } from "@/utils/normalizeMaintainVisibleContentPosition";
import { requestAdjust } from "@/utils/requestAdjust";
import { isHorizontalRTLProps } from "@/utils/rtl";
import { setPaddingTop } from "@/utils/setPaddingTop";
import { updateSnapToOffsets } from "@/utils/updateSnapToOffsets";

export interface DatasetLayerHandle {
    ctx: StateContext;
    setCanRender: (value: boolean) => void;
    dataLength: number;
    horizontal: boolean;
    usesBootstrapInitialScroll: boolean;
    initialScroll: InternalState["initialScroll"];
    stylePaddingBottom: number;
}

export interface DatasetLayerInnerProps<T> extends Omit<LegendListPropsBase<T, LooseScrollViewProps>, "children"> {
    animatedPropsInternal?: StylesAsSharedValue<LooseScrollViewProps>;
    childrenMode?: boolean;
    data: ReadonlyArray<T>;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: T }>;
    positionComponentInternal?: React.ComponentType;
    renderItem: (props: LegendListRenderItemProps<T, string | undefined>) => React.ReactNode;
    stickyHeaderConfig?: StickyHeaderConfig;
    stickyPositionComponentInternal?: React.ComponentType;
    // Shared scroll resources (from outer)
    sharedAnimatedScrollY: AnimatedValue;
    sharedRefScroller: React.RefObject<LegendListScrollerRef | null>;
    // Is this layer currently active? Affects sticky/MVCP gating.
    isActive: boolean;
    // Outer registers this layer so it can fan out layout/header/scroll/padding events
    registerLayer: (key: string, handle: DatasetLayerHandle | null) => void;
    layerKey: string;
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const DatasetLayerInner = typedForwardRef(function DatasetLayerInner<T>(
    props: DatasetLayerInnerProps<T>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    if (props.recycleItems === undefined) {
        warnDevOnce(
            "recycleItems-omitted",
            "recycleItems was not provided to LegendListDatasets. It defaults to false. Set it explicitly to true for better performance with recycling-aware rows, or false to preserve remount-on-reuse.",
        );
    }
    const {
        alignItemsAtEnd = false,
        anchoredEndSpace,
        alwaysRender,
        columnWrapperStyle,
        contentContainerStyle: contentContainerStyleProp,
        contentInset,
        data: dataProp = [],
        dataVersion,
        drawDistance = 250,
        contentInsetEndAdjustment,
        estimatedItemSize = 100,
        estimatedListSize,
        extraData,
        getEstimatedItemSize,
        getFixedItemSize,
        getItemType,
        horizontal,
        rtl,
        initialContainerPoolRatio = 3,
        estimatedHeaderSize,
        initialScrollAtEnd = false,
        initialScrollIndex: initialScrollIndexProp,
        initialScrollOffset: initialScrollOffsetProp,
        itemsAreEqual,
        keyExtractor: keyExtractorProp,
        ListFooterComponent: _ListFooterComponent,
        ListHeaderComponent: _ListHeaderComponent,
        maintainScrollAtEnd = false,
        maintainScrollAtEndThreshold = 0.1,
        maintainVisibleContentPosition: maintainVisibleContentPositionProp,
        numColumns: numColumnsProp = 1,
        overrideItemLayout,
        onEndReached,
        onEndReachedThreshold = 0.5,
        onItemSizeChanged,
        onMetricsChange,
        onLoad,
        onScroll: onScrollProp,
        onStartReached,
        onStartReachedThreshold = 0.5,
        onStickyHeaderChange,
        onViewableItemsChanged,
        recycleItems = false,
        snapToIndices,
        stickyHeaderIndices: stickyHeaderIndicesProp,
        stickyIndices: stickyIndicesDeprecated,
        style: styleProp,
        useWindowScroll: _useWindowScroll = false,
        viewabilityConfig,
        viewabilityConfigCallbackPairs,
        ItemSeparatorComponent,
        stickyHeaderConfig,
        // Shared
        sharedAnimatedScrollY,
        sharedRefScroller,
        isActive: _isActive,
        registerLayer,
        layerKey,
    } = props;

    const { animatedPropsInternal, positionComponentInternal, stickyPositionComponentInternal } = props;

    // Re-derive padding the same way LegendListInner does.
    const baseContent: ViewStyle | undefined = StyleSheet.flatten(contentContainerStyleProp);
    const style: ViewStyle = styleProp ? (StyleSheet.flatten(styleProp) ?? {}) : {};
    const contentContainerStyle: ViewStyle = baseContent ?? {};
    const stylePaddingTopState = extractPadding(style, contentContainerStyle, "Top");
    const stylePaddingBottomState = extractPadding(style, contentContainerStyle, "Bottom");
    const stylePaddingLeftState = extractPadding(style, contentContainerStyle, "Left");
    const stylePaddingRightState = extractPadding(style, contentContainerStyle, "Right");

    const maintainScrollAtEndConfig = normalizeMaintainScrollAtEnd(maintainScrollAtEnd);
    const maintainVisibleContentPositionConfig = normalizeMaintainVisibleContentPosition(
        maintainVisibleContentPositionProp,
    );

    const hasInitialScrollIndex = initialScrollIndexProp !== undefined && initialScrollIndexProp !== null;
    const hasInitialScrollOffset = initialScrollOffsetProp !== undefined && initialScrollOffsetProp !== null;
    const shouldInitializeHorizontalRTL =
        !initialScrollAtEnd &&
        !hasInitialScrollIndex &&
        !hasInitialScrollOffset &&
        isHorizontalRTLProps({ horizontal, rtl });
    const initialScrollUsesOffsetOnly =
        !initialScrollAtEnd && !hasInitialScrollIndex && (hasInitialScrollOffset || shouldInitializeHorizontalRTL);
    const usesBootstrapInitialScroll = initialScrollAtEnd || hasInitialScrollIndex;
    const initialScrollProp: InternalState["initialScroll"] = initialScrollAtEnd
        ? {
              index: Math.max(0, dataProp.length - 1),
              preserveForBottomPadding: true,
              viewOffset: -stylePaddingBottomState,
              viewPosition: 1,
          }
        : hasInitialScrollIndex
          ? typeof initialScrollIndexProp === "object"
              ? {
                    index: initialScrollIndexProp.index ?? 0,
                    preserveForBottomPadding:
                        initialScrollIndexProp.viewOffset === undefined && initialScrollIndexProp.viewPosition === 1
                            ? true
                            : undefined,
                    viewOffset:
                        initialScrollIndexProp.viewOffset ??
                        (initialScrollIndexProp.viewPosition === 1 ? -stylePaddingBottomState : 0),
                    viewPosition: initialScrollIndexProp.viewPosition ?? 0,
                }
              : {
                    index: initialScrollIndexProp ?? 0,
                    viewOffset: initialScrollOffsetProp ?? 0,
                }
          : initialScrollUsesOffsetOnly
            ? {
                  contentOffset: initialScrollOffsetProp ?? 0,
                  index: 0,
                  viewOffset: 0,
              }
            : undefined;

    const [canRender, setCanRender] = React.useState(!IsNewArchitecture);

    const ctx = useStateContext();
    ctx.columnWrapperStyle = columnWrapperStyle || (baseContent ? createColumnWrapperStyle(baseContent) : undefined);

    const keyExtractor = keyExtractorProp ?? ((_item: T, index: number) => index.toString());
    const stickyHeaderIndices = stickyHeaderIndicesProp ?? stickyIndicesDeprecated;
    const contentInsetEndAdjustmentResolved = Platform.OS === "web" ? contentInsetEndAdjustment : undefined;
    const previousContentInsetEndAdjustmentRef = useRef(contentInsetEndAdjustmentResolved);
    const alwaysRenderIndices = useMemo(() => {
        const indices = getAlwaysRenderIndices(alwaysRender, dataProp, keyExtractor, anchoredEndSpace?.anchorIndex);
        return { arr: indices, set: new Set(indices) };
    }, [
        anchoredEndSpace?.anchorIndex,
        alwaysRender?.top,
        alwaysRender?.bottom,
        alwaysRender?.indices?.join(","),
        alwaysRender?.keys?.join(","),
        dataProp,
        dataVersion,
        keyExtractor,
    ]);
    const stickyIndicesSet = useMemo(() => new Set(stickyHeaderIndices ?? []), [stickyHeaderIndices?.join(",")]);
    const wrappedGetEstimatedItemSize = useWrapIfItem(getEstimatedItemSize);
    const wrappedGetFixedItemSize = useWrapIfItem(getFixedItemSize);
    const wrappedGetItemType = useWrapIfItem(getItemType);
    const wrappedKeyExtractor = useWrapIfItem(keyExtractor);
    const anchoredEndSpaceResolved =
        Platform.OS === "web" && anchoredEndSpace ? { ...anchoredEndSpace, includeInEndInset: true } : anchoredEndSpace;

    const refState = useRef<InternalState | undefined>(undefined);
    const hasOverrideItemLayout = !!overrideItemLayout;
    const prevHasOverrideItemLayout = useRef(hasOverrideItemLayout);

    if (!refState.current) {
        if (!ctx.state) {
            const initialScrollLength = (estimatedListSize ??
                (IsNewArchitecture ? { height: 0, width: 0 } : getWindowSize()))[horizontal ? "width" : "height"];

            // Overwrite the per-StateProvider animatedScrollY with the SHARED one so all
            // layers' sticky/position math drives off a single scroll Animated.Value.
            ctx.animatedScrollY = sharedAnimatedScrollY;

            ctx.state = {
                averageSizes: {},
                columnSpans: [],
                columns: [],
                containerItemKeys: new Map(),
                containerItemTypes: new Map(),
                contentInsetOverride: undefined,
                dataChangeEpoch: 0,
                dataChangeNeedsScrollUpdate: false,
                didColumnsChange: false,
                didDataChange: false,
                enableScrollForNextCalculateItemsInView: true,
                endBuffered: -1,
                endNoBuffer: -1,
                endReachedSnapshot: undefined,
                firstFullyOnScreenIndex: -1,
                idCache: [],
                idsInView: [],
                indexByKey: new Map(),
                initialScroll: initialScrollProp,
                initialScrollSession: initialScrollProp
                    ? {
                          kind: initialScrollUsesOffsetOnly ? "offset" : "bootstrap",
                          previousDataLength: dataProp.length,
                      }
                    : undefined,
                isEndReached: null,
                isFirst: true,
                isStartReached: null,
                lastBatchingAction: Date.now(),
                lastLayout: undefined,
                lastScrollDelta: 0,
                loadStartTime: Date.now(),
                minIndexSizeChanged: 0,
                nativeContentInset: undefined,
                nativeMarginTop: 0,
                pendingDataComparison: undefined,
                pendingNativeMVCPAdjust: undefined,
                positions: [],
                props: {
                    alignItemsAtEnd,
                    alwaysRender,
                    alwaysRenderIndicesArr: alwaysRenderIndices.arr,
                    alwaysRenderIndicesSet: alwaysRenderIndices.set,
                    anchoredEndSpace: anchoredEndSpaceResolved,
                    animatedProps: animatedPropsInternal ?? {},
                    contentInset,
                    contentInsetEndAdjustment: contentInsetEndAdjustmentResolved,
                    data: dataProp,
                    dataVersion,
                    drawDistance,
                    estimatedItemSize,
                    getEstimatedItemSize: wrappedGetEstimatedItemSize,
                    getFixedItemSize: wrappedGetFixedItemSize,
                    getItemType: wrappedGetItemType,
                    horizontal: !!horizontal,
                    initialContainerPoolRatio,
                    itemsAreEqual,
                    keyExtractor: wrappedKeyExtractor,
                    maintainScrollAtEnd: maintainScrollAtEndConfig,
                    maintainScrollAtEndThreshold,
                    maintainVisibleContentPosition: maintainVisibleContentPositionConfig,
                    numColumns: numColumnsProp,
                    onEndReached,
                    onEndReachedThreshold,
                    onItemSizeChanged,
                    onLoad,
                    onScroll: onScrollProp,
                    onStartReached,
                    onStartReachedThreshold,
                    onStickyHeaderChange,
                    overrideItemLayout,
                    positionComponentInternal,
                    recycleItems: !!recycleItems,
                    renderItem: props.renderItem,
                    rtl,
                    snapToIndices,
                    stickyIndicesArr: stickyHeaderIndices ?? [],
                    stickyIndicesSet,
                    stickyPositionComponentInternal,
                    stylePaddingBottom: stylePaddingBottomState,
                    stylePaddingLeft: stylePaddingLeftState,
                    stylePaddingRight: stylePaddingRightState,
                    stylePaddingTop: stylePaddingTopState,
                    useWindowScroll: false,
                },
                queuedCalculateItemsInView: 0,
                refScroller: sharedRefScroller,
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
                startReachedSnapshot: undefined,
                startReachedSnapshotDataChangeEpoch: undefined,
                stickyContainerPool: new Set(),
                stickyContainers: new Map(),
                timeouts: new Set(),
                totalSize: 0,
                viewabilityConfigCallbackPairs: undefined as never,
            };

            const internalState = ctx.state;
            internalState.triggerCalculateItemsInView = (params) => calculateItemsInView(ctx, params);
            internalState.reprocessCurrentScroll = () => updateScroll(ctx, internalState.scroll, true);

            set$(ctx, "maintainVisibleContentPosition", maintainVisibleContentPositionConfig);
            set$(ctx, "extraData", extraData);
            if (estimatedHeaderSize !== undefined) {
                set$(ctx, "headerSize", estimatedHeaderSize);
            }
        }
        refState.current = ctx.state;
    }

    const state = refState.current!;
    const isFirstLocal = state.isFirst;
    const previousNumColumnsProp = state.props.numColumns;

    state.didColumnsChange = numColumnsProp !== previousNumColumnsProp;
    const didDataReferenceChangeLocal = state.props.data !== dataProp;
    const didDataVersionChangeLocal = state.props.dataVersion !== dataVersion;
    const didDataChangeLocal =
        didDataVersionChangeLocal ||
        (didDataReferenceChangeLocal && checkStructuralDataChange(state, dataProp, state.props.data));
    if (
        didDataChangeLocal &&
        !initialScrollAtEnd &&
        state.didFinishInitialScroll &&
        state.initialScroll?.viewPosition === 1 &&
        state.props.data.length > 0
    ) {
        clearPreservedInitialScrollTarget(state);
    }
    if (didDataChangeLocal) {
        state.dataChangeEpoch += 1;
        state.dataChangeNeedsScrollUpdate = true;
        state.didDataChange = true;
        state.previousData = state.props.data;
    }
    const didAnchoredEndSpaceAnchorIndexChange =
        !isFirstLocal &&
        !didDataChangeLocal &&
        state.props.anchoredEndSpace?.anchorIndex !== anchoredEndSpaceResolved?.anchorIndex;

    state.props = {
        alignItemsAtEnd,
        alwaysRender,
        alwaysRenderIndicesArr: alwaysRenderIndices.arr,
        alwaysRenderIndicesSet: alwaysRenderIndices.set,
        anchoredEndSpace: anchoredEndSpaceResolved,
        animatedProps: animatedPropsInternal ?? {},
        contentInset,
        contentInsetEndAdjustment: contentInsetEndAdjustmentResolved,
        data: dataProp,
        dataVersion,
        drawDistance,
        estimatedItemSize,
        getEstimatedItemSize: wrappedGetEstimatedItemSize,
        getFixedItemSize: wrappedGetFixedItemSize,
        getItemType: wrappedGetItemType,
        horizontal: !!horizontal,
        initialContainerPoolRatio,
        itemsAreEqual,
        keyExtractor: wrappedKeyExtractor,
        maintainScrollAtEnd: maintainScrollAtEndConfig,
        maintainScrollAtEndThreshold,
        maintainVisibleContentPosition: maintainVisibleContentPositionConfig,
        numColumns: numColumnsProp,
        onEndReached,
        onEndReachedThreshold,
        onItemSizeChanged,
        onLoad,
        onScroll: onScrollProp,
        onStartReached,
        onStartReachedThreshold,
        onStickyHeaderChange,
        overrideItemLayout,
        positionComponentInternal,
        recycleItems: !!recycleItems,
        renderItem: props.renderItem,
        rtl,
        snapToIndices,
        stickyIndicesArr: stickyHeaderIndices ?? [],
        stickyIndicesSet,
        stickyPositionComponentInternal,
        stylePaddingBottom: stylePaddingBottomState,
        stylePaddingLeft: stylePaddingLeftState,
        stylePaddingRight: stylePaddingRightState,
        stylePaddingTop: stylePaddingTopState,
        useWindowScroll: false,
    };

    state.refScroller = sharedRefScroller;

    // Register / unregister this layer with the outer for fan-out wiring.
    useLayoutEffect(() => {
        registerLayer(layerKey, {
            ctx,
            dataLength: dataProp.length,
            horizontal: !!horizontal,
            initialScroll: state.initialScroll,
            setCanRender,
            stylePaddingBottom: stylePaddingBottomState,
            usesBootstrapInitialScroll,
        });
        return () => registerLayer(layerKey, null);
        // Re-register when these load-bearing values change so outer's bootstrap
        // footer-layout handler has current data.
    }, [
        ctx,
        layerKey,
        registerLayer,
        dataProp.length,
        horizontal,
        usesBootstrapInitialScroll,
        stylePaddingBottomState,
    ]);

    const memoizedLastItemKeys = useMemo(() => {
        if (!dataProp.length) return [];
        return Array.from({ length: Math.min(numColumnsProp, dataProp.length) }, (_, i) =>
            getId(state, dataProp.length - 1 - i),
        );
    }, [dataProp, dataVersion, numColumnsProp]);

    const initializeStateVars = (shouldAdjustPadding: boolean) => {
        set$(ctx, "lastItemKeys", memoizedLastItemKeys);
        set$(ctx, "numColumns", numColumnsProp);

        const prevPaddingTop = peek$(ctx, "stylePaddingTop");
        setPaddingTop(ctx, { stylePaddingTop: stylePaddingTopState });
        refState.current!.props.stylePaddingBottom = stylePaddingBottomState;

        let paddingDiff = stylePaddingTopState - prevPaddingTop;
        if (
            shouldAdjustPadding &&
            maintainVisibleContentPositionConfig.size &&
            paddingDiff &&
            prevPaddingTop !== undefined &&
            Platform.OS === "ios"
        ) {
            if (state.scroll < 0) {
                paddingDiff += state.scroll;
            }
            requestAdjust(ctx, paddingDiff);
        }
    };

    if (isFirstLocal) {
        initializeStateVars(false);
        resetLayoutCachesForDataChange(state);
        updateItemPositions(ctx, /*dataChanged*/ true);
    }

    if (isFirstLocal || didDataChangeLocal || numColumnsProp !== peek$(ctx, "numColumns")) {
        refState.current.lastBatchingAction = Date.now();
        if (!keyExtractorProp && !isFirstLocal && didDataChangeLocal) {
            refState.current.sizes.clear();
            refState.current.positions.length = 0;
            refState.current.totalSize = 0;
            set$(ctx, "totalSize", 0);
        }
    }

    if (IS_DEV) {
        useDevChecks(props);
    }

    useLayoutEffect(() => {
        handleInitialScrollDataChange(ctx, {
            dataLength: dataProp.length,
            didDataChange: didDataChangeLocal,
            initialScrollAtEnd,
            stylePaddingBottom: stylePaddingBottomState,
            useBootstrapInitialScroll: usesBootstrapInitialScroll,
        });
    }, [dataProp.length, didDataChangeLocal, initialScrollAtEnd, stylePaddingBottomState, usesBootstrapInitialScroll]);

    useLayoutEffect(() => {
        if (didAnchoredEndSpaceAnchorIndexChange) {
            state.scrollForNextCalculateItemsInView = undefined;
            state.triggerCalculateItemsInView?.();
        }
        maybeUpdateAnchoredEndSpace(ctx);
    }, [
        ctx,
        dataProp,
        dataVersion,
        anchoredEndSpace?.anchorIndex,
        anchoredEndSpace?.anchorMaxSize,
        anchoredEndSpace?.anchorOffset,
        didAnchoredEndSpaceAnchorIndexChange,
        numColumnsProp,
    ]);

    useLayoutEffect(() => {
        const previousContentInsetEndAdjustment = previousContentInsetEndAdjustmentRef.current;
        previousContentInsetEndAdjustmentRef.current = contentInsetEndAdjustmentResolved;
        updateContentInsetEndAdjustment(ctx, previousContentInsetEndAdjustment);
    }, [ctx, contentInsetEndAdjustmentResolved]);

    useLayoutEffect(() => {
        if (snapToIndices) {
            updateSnapToOffsets(ctx);
        }
    }, [snapToIndices]);

    useLayoutEffect(
        () => initializeStateVars(true),
        [dataVersion, memoizedLastItemKeys.join(","), numColumnsProp, stylePaddingBottomState, stylePaddingTopState],
    );

    useLayoutEffect(() => {
        const {
            didColumnsChange,
            didDataChange,
            isFirst,
            props: { data },
        } = state;
        const didAllocateContainers = data.length > 0 && doInitialAllocateContainers(ctx);
        if (!didAllocateContainers && !isFirst && (didDataChange || didColumnsChange)) {
            checkResetContainers(ctx, data, { didColumnsChange });
        }
        if (didDataChange) {
            state.pendingDataComparison = undefined;
        }
        state.didColumnsChange = false;
        state.didDataChange = false;
        state.isFirst = false;
    }, [dataProp, dataVersion, numColumnsProp]);

    useLayoutEffect(() => {
        set$(ctx, "extraData", extraData);
        const didToggleOverride = prevHasOverrideItemLayout.current !== hasOverrideItemLayout;
        prevHasOverrideItemLayout.current = hasOverrideItemLayout;
        if ((hasOverrideItemLayout || didToggleOverride) && numColumnsProp > 1) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }
    }, [extraData, hasOverrideItemLayout, numColumnsProp]);

    useEffect(() => {
        if (!onMetricsChange) return;
        let lastMetrics: LegendListMetrics | undefined;
        const emitMetrics = () => {
            const metrics: LegendListMetrics = {
                footerSize: peek$(ctx, "footerSize") || 0,
                headerSize: peek$(ctx, "headerSize") || 0,
            };
            if (
                !lastMetrics ||
                metrics.headerSize !== lastMetrics.headerSize ||
                metrics.footerSize !== lastMetrics.footerSize
            ) {
                lastMetrics = metrics;
                onMetricsChange(metrics);
            }
        };
        emitMetrics();
        const unsubscribe = [listen$(ctx, "headerSize", emitMetrics), listen$(ctx, "footerSize", emitMetrics)];
        return () => {
            for (const unsub of unsubscribe) unsub();
        };
    }, [ctx, onMetricsChange]);

    useEffect(() => {
        const viewability = setupViewability({
            onViewableItemsChanged,
            viewabilityConfig,
            viewabilityConfigCallbackPairs,
        });
        state.viewabilityConfigCallbackPairs = viewability;
        state.enableScrollForNextCalculateItemsInView = !viewability;
    }, [viewabilityConfig, viewabilityConfigCallbackPairs, onViewableItemsChanged]);

    useInit(() => {
        if (!IsNewArchitecture) {
            doInitialAllocateContainers(ctx);
        }
    });

    useImperativeHandle(forwardedRef, () => createImperativeHandle(ctx), []);

    const fns = useMemo(
        () => ({
            getRenderedItem: (key: string) => getRenderedItem(ctx, key),
            updateItemSize: (itemKey: string, sizeObj: { width: number; height: number }) =>
                updateItemSize(ctx, itemKey, sizeObj),
        }),
        [],
    );

    // We render absolutely-positioned: the outer ContentArea owns the scroll-height.
    // Each layer fills the content area. <Containers /> inside has its own animated
    // height-View; that's fine since per-item positions are absolute within it.
    if (!canRender) {
        // Match LegendListInner: on new arch, defer Containers until layout has run.
        return <ScrollAdjust />;
    }

    return (
        <>
            <ScrollAdjust />
            <Containers
                getRenderedItem={fns.getRenderedItem}
                horizontal={!!horizontal}
                ItemSeparatorComponent={ItemSeparatorComponent}
                recycleItems={!!recycleItems}
                stickyHeaderConfig={stickyHeaderConfig}
                updateItemSize={fns.updateItemSize}
            />
        </>
    );
});
