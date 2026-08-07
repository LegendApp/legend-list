import * as React from "react";
import {
    type ForwardedRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
} from "react";

import { DebugView } from "@/components/DebugView";
import { ListComponent } from "@/components/ListComponent";
import { useDevChecks } from "@/components/useDevChecks";
import { ENABLE_DEBUG_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { resetAdaptiveRender } from "@/core/adaptiveRender";
import {
    handleBootstrapInitialScrollFooterLayout,
    handleBootstrapInitialScrollLayoutChange,
} from "@/core/bootstrapInitialScroll";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import { cancelImperativeScroll } from "@/core/cancelImperativeScroll";
import { checkFinishedScrollFallback } from "@/core/checkFinishedScroll";
import { checkResetContainers } from "@/core/checkResetContainers";
import { checkStructuralDataChange } from "@/core/checkStructuralDataChange";
import { applyDataSourceMutationBatches } from "@/core/DataSourceMutationCoordinator";
import { DataSourceObserver } from "@/core/DataSourceObserver";
import { doInitialAllocateContainers } from "@/core/doInitialAllocateContainers";
import { clearPreservedInitialScrollTarget } from "@/core/finishInitialScroll";
import { handleLayout } from "@/core/handleLayout";
import { ArrayDataAdapter, DataSourceAdapter, getDataLength } from "@/core/IndexedData";
import { advanceCurrentInitialScrollSession, resolveInitialScrollOffset } from "@/core/initialScroll";
import { handleInitialScrollDataChange, initializeInitialScrollOnMount } from "@/core/initialScrollLifecycle";
import {
    clearLayoutStoreKnownSizes,
    rebuildLayoutStoreExact,
    syncLayoutStoreState,
    syncLayoutStoreStructure,
} from "@/core/layoutStoreLifecycle";
import { onScroll } from "@/core/onScroll";
import { resetLayoutCachesForDataChange } from "@/core/resetLayoutCachesForDataChange";
import { ScheduledWork } from "@/core/ScheduledWork";
import { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import { maybeUpdateAnchoredEndSpace } from "@/core/updateAnchoredEndSpace";
import { updateContentInsetEndAdjustment } from "@/core/updateContentInsetEndAdjustment";
import { updateContentMetricsState } from "@/core/updateContentMetricsState";
import { updateScroll } from "@/core/updateScroll";
import { useWrapIfItem } from "@/core/useWrapIfItem";
import { hasViewabilityConsumers, requestViewabilityRecalculation, setupViewability } from "@/core/viewability";
import { useCombinedRef } from "@/hooks/useCombinedRef";
import { useInit } from "@/hooks/useInit";
import { useOnLayoutSync } from "@/hooks/useOnLayoutSync";
import { getWindowSize } from "@/platform/getWindowSize";
import { Platform } from "@/platform/Platform";
import type { LayoutRectangle, NativeScrollEvent, NativeSyntheticEvent } from "@/platform/platform-types";
import { RefreshControl } from "@/platform/RefreshControl";
import { StyleSheet } from "@/platform/StyleSheet";
import type { LooseScrollView, LooseScrollViewProps, LooseView, ViewStyle } from "@/platform/scrollview-types";
import { useStickyScrollHandler } from "@/platform/useStickyScrollHandler";
import { listen$, peek$, StateProvider, set$, useStateContext } from "@/state/state";
import type {
    LegendListDataSource,
    LegendListMetrics,
    LegendListRef,
    ViewabilityConfig,
    ViewabilityConfigCallbackPairs,
} from "@/types.base";
import type {
    AnchoredEndSpaceOwner,
    InternalState,
    LegendListPropsBase,
    LegendListScrollerRef,
} from "@/types.internal";
import { typedForwardRef, typedMemo } from "@/types.internal";
import type { StylesAsSharedValue } from "@/typesInternal";
import { createColumnWrapperStyle } from "@/utils/createColumnWrapperStyle";
import { createImperativeHandle } from "@/utils/createImperativeHandle";
import { IS_DEV } from "@/utils/devEnvironment";
import { prepareReachedEdgeForNextUserScroll } from "@/utils/edgeReachedGate";
import { getAlwaysRenderIndices } from "@/utils/getAlwaysRenderIndices";
import { getId } from "@/utils/getId";
import { getRenderedItem } from "@/utils/getRenderedItem";
import { extractPadding, isArray, warnDevOnce } from "@/utils/helpers";
import { normalizeMaintainScrollAtEnd } from "@/utils/normalizeMaintainScrollAtEnd";
import { normalizeMaintainVisibleContentPosition } from "@/utils/normalizeMaintainVisibleContentPosition";
import { requestAdjust } from "@/utils/requestAdjust";
import { getStylePaddingEnd, isHorizontalRTLProps } from "@/utils/rtl";
import { resetInitialRenderState } from "@/utils/setInitialRenderState";
import { setPaddingTop } from "@/utils/setPaddingTop";
import { useThrottledOnScroll } from "@/utils/throttledOnScroll";
import { updateSnapToOffsets } from "@/utils/updateSnapToOffsets";

export const LegendList = typedMemo(
    // biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
    typedForwardRef(function LegendList<T>(
        props: LegendListPropsBase<T, LooseScrollViewProps>,
        forwardedRef: ForwardedRef<LegendListRef>,
    ) {
        // Handle children mode - convert children to data array at the top level
        const { children, data: dataProp, dataSource, renderItem: renderItemProp, ...restProps } = props;
        const isChildrenMode = children !== undefined && dataProp === undefined && dataSource === undefined;

        const processedProps = isChildrenMode
            ? {
                  ...restProps,
                  childrenMode: true,
                  data: (isArray(children) ? children : React.Children.toArray(children)).flat(1) as T[],
                  dataSource: undefined,
                  renderItem: ({ item }: { item: T }) => item as React.ReactNode,
              }
            : {
                  ...restProps,
                  data: dataProp || [],
                  dataSource,
                  renderItem: renderItemProp!,
              };

        return (
            <StateProvider>
                <LegendListInner {...processedProps} ref={forwardedRef} />
            </StateProvider>
        );
    }),
);

type LegendListInnerProps<T> = Omit<LegendListPropsBase<T, LooseScrollViewProps>, "children"> & {
    childrenMode?: boolean;
    data: ReadonlyArray<T>;
    dataSource?: LegendListDataSource<T>;
    renderItem: (props: any) => React.ReactNode;
};

function areViewabilityConfigsEqual(a: ViewabilityConfig | undefined, b: ViewabilityConfig | undefined) {
    return (
        a?.id === b?.id &&
        a?.itemVisiblePercentThreshold === b?.itemVisiblePercentThreshold &&
        a?.minimumViewTime === b?.minimumViewTime &&
        a?.startOffset === b?.startOffset &&
        a?.viewAreaCoveragePercentThreshold === b?.viewAreaCoveragePercentThreshold &&
        a?.waitForInteraction === b?.waitForInteraction
    );
}

function areViewabilityConfigPairsEqual(
    a: ViewabilityConfigCallbackPairs<any> | undefined,
    b: ViewabilityConfigCallbackPairs<any> | undefined,
) {
    return (
        a?.length === b?.length &&
        (a === b ||
            a?.every((pair, index) => areViewabilityConfigsEqual(pair.viewabilityConfig, b?.[index].viewabilityConfig)))
    );
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const LegendListInner = typedForwardRef(function LegendListInner<T>(
    props: LegendListInnerProps<T>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const noopOnScroll = useCallback((_event: NativeSyntheticEvent<NativeScrollEvent>) => {}, []);
    if (props.recycleItems === undefined) {
        warnDevOnce(
            "recycleItems-omitted",
            "recycleItems was not provided, so it defaults to false. Set recycleItems explicitly to true for better performance with recycling-aware rows, or false to preserve remount-on-reuse behavior.",
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
        dataSource,
        dataKey,
        dataVersion,
        drawDistance = 250,
        contentInsetEndAdjustment,
        estimatedItemSize = 100,
        estimatedListSize,
        extraData,
        getFixedItemSize,
        getItemType,
        horizontal,
        rtl,
        estimatedHeaderSize,
        initialScrollAtEnd = false,
        initialScrollIndex: initialScrollIndexProp,
        initialScrollOffset: initialScrollOffsetProp,
        experimental_adaptiveRender,
        itemsAreEqual,
        keyExtractor: keyExtractorProp,
        ListEmptyComponent,
        ListFooterComponent,
        ListFooterComponentStyle,
        ListHeaderComponent,
        maintainScrollAtEnd = false,
        maintainScrollAtEndThreshold = 0.1,
        maintainVisibleContentPosition: maintainVisibleContentPositionProp,
        numColumns: numColumnsPropRaw = 1,
        overrideItemLayout,
        onEndReached,
        onEndReachedThreshold = 0.5,
        onItemSizeChanged,
        onMetricsChange,
        onLayout: onLayoutProp,
        onLoad,
        onMomentumScrollEnd,
        onRefresh,
        onScroll: onScrollProp,
        onScrollBeginDrag,
        onStartReached,
        onStartReachedThreshold = 0.5,
        onStickyHeaderChange,
        onFirstVisibleItemChanged,
        onViewableItemsChanged,
        progressViewOffset,
        recycleItems = false,
        refreshControl,
        refreshing,
        refScrollView,
        renderScrollComponent,
        renderItem,
        scrollEventThrottle,
        snapToIndices,
        stickyHeaderIndices: stickyHeaderIndicesProp,
        style: styleProp,
        useWindowScroll = false,
        viewabilityConfig,
        viewabilityConfigCallbackPairs,
        ...rest
    } = props;
    const numColumnsProp = normalizeNumColumnsProp(numColumnsPropRaw);

    const indexedData = useMemo(
        () => (dataSource ? new DataSourceAdapter(dataSource) : new ArrayDataAdapter(dataProp, keyExtractorProp)),
        [dataProp, dataSource, keyExtractorProp],
    );
    const dataLength = indexedData.getLength();
    const dataSourceRevision = dataSource?.getRevision();

    const animatedPropsInternal = (props as any).animatedPropsInternal as StylesAsSharedValue<LooseScrollViewProps>;
    const anchoredEndSpaceOwner =
        ((props as any).anchoredEndSpaceOwnerInternal as AnchoredEndSpaceOwner | undefined) ?? "list";
    const positionComponentInternal = (props as any).positionComponentInternal as React.ComponentType<any> | undefined;
    const stickyPositionComponentInternal = (props as any).stickyPositionComponentInternal as
        | React.ComponentType<any>
        | undefined;
    const {
        anchoredEndSpaceOwnerInternal: _anchoredEndSpaceOwnerInternal,
        positionComponentInternal: _positionComponentInternal,
        stickyPositionComponentInternal: _stickyPositionComponentInternal,
        ...restProps
    } = rest as any;

    const contentContainerStyleBase = StyleSheet.flatten(contentContainerStyleProp) as ViewStyle | undefined;
    const useAlignItemsAtEndPadding =
        alignItemsAtEnd && !horizontal && contentContainerStyleBase?.minHeight == null && dataLength > 0;
    const shouldFlexGrow =
        alignItemsAtEnd &&
        !useAlignItemsAtEndPadding &&
        (horizontal ? contentContainerStyleBase?.minWidth == null : contentContainerStyleBase?.minHeight == null);
    const contentContainerStyle: ViewStyle = {
        ...contentContainerStyleBase,
        ...(alignItemsAtEnd && !useAlignItemsAtEndPadding
            ? {
                  display: "flex",
                  flexDirection: horizontal ? "row" : "column",
                  ...(shouldFlexGrow ? { flexGrow: 1 } : {}),
                  justifyContent: "flex-end",
              }
            : {}),
    };
    const style = { ...StyleSheet.flatten(styleProp) };
    const stylePaddingTopState = extractPadding(style, contentContainerStyle, "Top");
    const stylePaddingBottomState = extractPadding(style, contentContainerStyle, "Bottom");
    const stylePaddingLeftState = extractPadding(style, contentContainerStyle, "Left");
    const stylePaddingRightState = extractPadding(style, contentContainerStyle, "Right");
    const stylePaddingEndState = getStylePaddingEnd({
        horizontal,
        rtl,
        stylePaddingBottom: stylePaddingBottomState,
        stylePaddingLeft: stylePaddingLeftState,
        stylePaddingRight: stylePaddingRightState,
    });
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
              index: Math.max(0, dataLength - 1),
              preserveForBottomPadding: true,
              viewOffset: -stylePaddingEndState,
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
                        (initialScrollIndexProp.viewPosition === 1 ? -stylePaddingEndState : 0),
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
    const [, scheduleImperativeScrollCommit] = React.useReducer((value: number) => value + 1, 0);
    const [, scheduleDataSourceCommit] = React.useReducer((value: number) => value + 1, 0);

    const ctx = useStateContext();
    ctx.columnWrapperStyle =
        columnWrapperStyle || (contentContainerStyle ? createColumnWrapperStyle(contentContainerStyle) : undefined);
    const scrollAxisGap = horizontal
        ? (ctx.columnWrapperStyle?.columnGap ?? ctx.columnWrapperStyle?.gap)
        : (ctx.columnWrapperStyle?.rowGap ?? ctx.columnWrapperStyle?.gap);
    const nextScrollAxisGap = typeof scrollAxisGap === "number" && Number.isFinite(scrollAxisGap) ? scrollAxisGap : 0;

    const refScroller = useRef<LooseScrollView>(null);
    const combinedRef = useCombinedRef(refScroller, refScrollView);
    const keyExtractor = dataSource
        ? (_item: T, index: number) => indexedData.getKey(index)
        : (keyExtractorProp ?? ((_item: T, index: number) => index.toString()));
    const stickyHeaderIndices = stickyHeaderIndicesProp;
    const contentInsetEndAdjustmentResolved = Platform.OS === "web" ? contentInsetEndAdjustment : undefined;
    const previousContentInsetEndAdjustmentRef = useRef(contentInsetEndAdjustmentResolved);
    const alwaysRenderIndices = useMemo(() => {
        const indices = getAlwaysRenderIndices(alwaysRender, indexedData, keyExtractor, anchoredEndSpace?.anchorIndex);
        return { arr: indices, set: new Set(indices) };
    }, [
        anchoredEndSpace?.anchorIndex,
        alwaysRender?.top,
        alwaysRender?.bottom,
        alwaysRender?.indices?.join(","),
        alwaysRender?.keys?.join(","),
        dataProp,
        indexedData,
        dataKey,
        dataVersion,
        keyExtractor,
    ]);

    const useWindowScrollResolved = Platform.OS === "web" && !!useWindowScroll && !renderScrollComponent;

    const refState = useRef<InternalState | undefined>(undefined);
    const hasOverrideItemLayout = !!overrideItemLayout;
    const prevHasOverrideItemLayout = useRef(hasOverrideItemLayout);

    if (!refState.current) {
        // Saving the state onto the context avoids recreating this twice in strict mode,
        // which can cause all sorts of issues because all our functions expect it to be created once.
        if (!ctx.state) {
            const initialScrollLength = (estimatedListSize ??
                (IsNewArchitecture ? { height: 0, width: 0 } : getWindowSize()))[horizontal ? "width" : "height"];
            ctx.values.set("adaptiveRender", experimental_adaptiveRender?.initialMode ?? "normal");

            ctx.state = {
                averageSizes: {},
                containerItemGenerations: [],
                containerItemKeys: new Map(),
                containerItemMetadata: new Map(),
                contentInsetOverride: undefined,
                dataChangeEpoch: 0,
                dataChangeKeyExtractorChanged: false,
                dataChangeNeedsScrollUpdate: false,
                didColumnsChange: false,
                didDataChange: false,
                didLoad: false,
                enableScrollForNextCalculateItemsInView: true,
                endBuffered: -1,
                endNoBuffer: -1,
                endReachedSnapshot: undefined,
                firstFullyOnScreenIndex: -1,
                freshDataTransitionEpoch: 0,
                hasHadNonEmptyData: dataLength > 0,
                idCache: [],
                idsInView: [],
                indexByKey: new Map(),
                indexedData,
                initialScroll: initialScrollProp,
                initialScrollSession: initialScrollProp
                    ? {
                          kind: initialScrollUsesOffsetOnly ? "offset" : "bootstrap",
                          previousDataLength: dataLength,
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
                props: {} as any,
                queuedCalculateItemsInView: 0,
                refScroller: { current: null } as React.RefObject<LegendListScrollerRef | null>,
                scheduledWork: new ScheduledWork(),
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
    const previousViewabilityConfigRef = useRef(viewabilityConfig);
    const previousViewabilityConfigPairsRef = useRef(viewabilityConfigCallbackPairs);
    const isFirstLocal = state.isFirst;
    const didDataSourceChangeLocal = state.props.dataSource !== dataSource;
    if (didDataSourceChangeLocal) {
        state.dataSourceNeedsReset = false;
        state.dataSourceAnchorPositions = undefined;
        state.dataSourceMutationApplied = false;
        state.dataSourcePreviousLength = undefined;
        state.dataSourceResetReason = undefined;
        state.dataSourceSpanInvalidationIndex = undefined;
        state.pendingDataSourceBatches = undefined;
    }
    const previousDataLength = isFirstLocal ? 0 : (state.dataSourcePreviousLength ?? getDataLength(state));
    state.indexedData = indexedData;
    const previousAdaptiveRender = state.props.adaptiveRender;
    const didScrollAxisChange = !isFirstLocal && state.props.horizontal !== !!horizontal;
    const previousNumColumnsProp = state.props.numColumns;
    const didScrollAxisGapChange = !isFirstLocal && ctx.scrollAxisGap !== nextScrollAxisGap;
    const wrappedGetFixedItemSize = useWrapIfItem(getFixedItemSize);
    const wrappedGetItemType = useWrapIfItem(getItemType);
    const wrappedKeyExtractor = useWrapIfItem(keyExtractor);

    ctx.scrollAxisGap = nextScrollAxisGap;
    state.didColumnsChange = numColumnsProp !== previousNumColumnsProp || didScrollAxisChange || didScrollAxisGapChange;
    const didDataReferenceChangeLocal = state.props.data !== dataProp;
    const didDataSourceMutationLocal = !!state.pendingDataSourceBatches?.length || !!state.dataSourceNeedsReset;
    const didDataKeyChangeLocal = state.props.dataKey !== dataKey;
    const didDataVersionChangeLocal = state.props.dataVersion !== dataVersion;
    const didKeyExtractorChange =
        state.props.hasReliableKeyExtractor !== (!!dataSource || !!keyExtractorProp) ||
        (!dataSource && !!keyExtractorProp && state.props.keyExtractor !== wrappedKeyExtractor);
    const didDataChangeLocal =
        didDataKeyChangeLocal ||
        didDataSourceChangeLocal ||
        didDataSourceMutationLocal ||
        didDataVersionChangeLocal ||
        (didDataReferenceChangeLocal && checkStructuralDataChange(state, dataProp, state.props.data));
    if (IS_DEV && didKeyExtractorChange && !didDataChangeLocal && !!state.props.hasReliableKeyExtractor) {
        warnDevOnce(
            "keyExtractor-identity-changed",
            "keyExtractor changed identity without a data change. Pass a stable keyExtractor because item identity is only recomputed during data changes.",
        );
    }
    const shouldResetFreshDataLayout =
        !isFirstLocal &&
        didDataChangeLocal &&
        state.hasHadNonEmptyData &&
        (didDataKeyChangeLocal || previousDataLength === 0) &&
        dataLength > 0;
    if (
        didDataChangeLocal &&
        !initialScrollAtEnd &&
        state.didFinishInitialScroll &&
        state.initialScroll?.viewPosition === 1 &&
        previousDataLength > 0
    ) {
        clearPreservedInitialScrollTarget(state);
    }
    if (didDataChangeLocal) {
        state.dataChangeEpoch += 1;
        state.dataChangeKeyExtractorChanged = didKeyExtractorChange;
        state.dataChangeNeedsScrollUpdate = true;
        state.didDataChange = true;
        state.previousData = dataSource ? undefined : state.props.data;
    }
    if (shouldResetFreshDataLayout) {
        state.freshDataTransitionEpoch += 1;
    }
    const throttledOnScroll = useThrottledOnScroll(onScrollProp ?? noopOnScroll, scrollEventThrottle ?? 0);
    const throttleScrollFn = scrollEventThrottle && onScrollProp ? throttledOnScroll : onScrollProp;
    const didAnchoredEndSpaceAnchorIndexChange =
        !isFirstLocal &&
        !didDataChangeLocal &&
        state.props.anchoredEndSpace?.anchorIndex !== anchoredEndSpace?.anchorIndex;
    const shouldExactSyncLayoutStore =
        !isFirstLocal &&
        !didDataChangeLocal &&
        (state.props.estimatedItemSize !== estimatedItemSize ||
            !!state.props.hasReliableKeyExtractor !== !!keyExtractorProp ||
            didScrollAxisChange ||
            didScrollAxisGapChange);

    state.props = {
        adaptiveRender: experimental_adaptiveRender,
        alignItemsAtEnd,
        alignItemsAtEndPaddingEnabled: useAlignItemsAtEndPadding,
        alwaysRender,
        alwaysRenderIndicesArr: alwaysRenderIndices.arr,
        alwaysRenderIndicesSet: alwaysRenderIndices.set,
        anchoredEndSpace,
        anchoredEndSpaceOwner,
        animatedProps: animatedPropsInternal,
        contentContainerAlignItems: contentContainerStyle.alignItems,
        contentInset,
        contentInsetEndAdjustment: contentInsetEndAdjustmentResolved,
        data: dataProp,
        dataKey,
        dataSource,
        dataVersion,
        drawDistance,
        estimatedItemSize,
        getFixedItemSize: wrappedGetFixedItemSize,
        getItemType: wrappedGetItemType,
        hasReliableKeyExtractor: !!dataSource || !!keyExtractorProp,
        horizontal: !!horizontal,
        itemsAreEqual,
        keyExtractor: wrappedKeyExtractor,
        maintainScrollAtEnd: maintainScrollAtEndConfig,
        maintainScrollAtEndThreshold,
        maintainVisibleContentPosition: maintainVisibleContentPositionConfig,
        numColumns: numColumnsProp,
        onEndReached,
        onEndReachedThreshold,
        onFirstVisibleItemChanged,
        onItemSizeChanged,
        onLoad,
        onMomentumScrollEnd,
        onScroll: throttleScrollFn,
        onScrollBeginDrag,
        onStartReached,
        onStartReachedThreshold,
        onStickyHeaderChange,
        overrideItemLayout,
        positionComponentInternal,
        recycleItems: !!recycleItems,
        renderItem: renderItem!,
        rtl,
        snapToIndices,
        stickyHeaderIndicesArr: stickyHeaderIndices ?? [],
        stickyHeaderIndicesSet: useMemo(() => new Set(stickyHeaderIndices ?? []), [stickyHeaderIndices?.join(",")]),
        stickyPositionComponentInternal,
        stylePaddingBottom: stylePaddingBottomState,
        stylePaddingLeft: stylePaddingLeftState,
        stylePaddingRight: stylePaddingRightState,
        stylePaddingTop: stylePaddingTopState,
        useWindowScroll: useWindowScrollResolved,
        viewabilityConfig,
    };

    useLayoutEffect(() => {
        if (!dataSource || dataSourceRevision === undefined) {
            return;
        }

        const observer = new DataSourceObserver(
            dataSource,
            {
                onBatch: (batch) => {
                    state.pendingDataSourceBatches ??= [];
                    state.pendingDataSourceBatches.push(batch);
                    state.dataSourcePreviousLength ??= batch.previousLength;
                    if (!state.dataSourceNeedsReset) {
                        const result = applyDataSourceMutationBatches(ctx, dataSource, [batch]);
                        state.dataSourceMutationApplied = state.dataSourceMutationApplied || result.applied;
                        if (result.applied) {
                            if (!state.layoutStoreRuntime) {
                                syncLayoutStoreStructure(ctx);
                            }
                            if (state.dataSourceSpanInvalidationIndex === undefined) {
                                syncLayoutStoreState(ctx);
                            }
                        }
                        if (result.resetReason) {
                            state.dataSourceNeedsReset = true;
                            state.dataSourceResetReason = result.resetReason;
                            state.dataSourceSpanInvalidationIndex = 0;
                            state.layoutStoreRuntime?.clearRowSpanCache();
                            if (result.resetReason !== "the data source requested a reset") {
                                warnDevOnce(
                                    "data-source-key-reset",
                                    `Resetting data-source state because ${result.resetReason}.`,
                                );
                            }
                        }
                    }
                    scheduleDataSourceCommit();
                },
                onReset: ({ batch, reason }) => {
                    state.pendingDataSourceBatches ??= [];
                    state.pendingDataSourceBatches.push(batch);
                    state.dataSourcePreviousLength ??= batch.previousLength;
                    state.dataSourceNeedsReset = true;
                    state.dataSourceResetReason = reason;
                    state.dataSourceSpanInvalidationIndex = 0;
                    state.layoutStoreRuntime?.clearRowSpanCache();
                    warnDevOnce("data-source-safe-reset", `Resetting data-source state because ${reason}.`);
                    scheduleDataSourceCommit();
                },
            },
            { length: dataLength, revision: dataSourceRevision },
        );

        return observer.start();
    }, [dataSource]);
    syncLayoutStoreStructure(ctx);
    if (shouldExactSyncLayoutStore) {
        rebuildLayoutStoreExact(ctx);
        syncLayoutStoreState(ctx);
    }

    state.refScroller = refScroller as unknown as React.RefObject<LegendListScrollerRef | null>;

    if (!isFirstLocal && previousAdaptiveRender && !experimental_adaptiveRender) {
        resetAdaptiveRender(ctx);
    }
    const memoizedLastItemKeys = useMemo(() => {
        if (!dataLength) return [];
        return Array.from({ length: Math.min(numColumnsProp, dataLength) }, (_, i) => getId(state, dataLength - 1 - i));
    }, [dataLength, dataProp, dataKey, dataSource, dataVersion, numColumnsProp]);

    // Run first time and whenever data changes
    const initializeStateVars = (shouldAdjustPadding: boolean) => {
        set$(ctx, "lastItemKeys", memoizedLastItemKeys);
        set$(ctx, "numColumns", numColumnsProp);

        // If the stylePaddingTop has changed, scroll to an adjusted offset to
        // keep the same content in view
        const prevPaddingTop = peek$(ctx, "stylePaddingTop");
        setPaddingTop(ctx, { stylePaddingTop: stylePaddingTopState });
        refState.current!.props.stylePaddingBottom = stylePaddingBottomState;
        updateContentMetricsState(ctx);

        let paddingDiff = stylePaddingTopState - prevPaddingTop;
        // If the style padding has changed then adjust the paddingTop and update scroll to compensate
        // Only iOS seems to need the scroll compensation
        if (
            shouldAdjustPadding &&
            maintainVisibleContentPositionConfig.size &&
            paddingDiff &&
            prevPaddingTop !== undefined &&
            Platform.OS === "ios"
        ) {
            // Scroll can be negative if being animated and that can break the pendingDiff
            if (state.scroll < 0) {
                paddingDiff += state.scroll;
            }

            requestAdjust(ctx, paddingDiff);
        }
    };

    if (isFirstLocal) {
        initializeStateVars(false);
        resetLayoutCachesForDataChange(state);
        if (state.initialScrollSession?.kind === "bootstrap" || snapToIndices?.length) {
            rebuildLayoutStoreExact(ctx);
        }
        syncLayoutStoreState(ctx);
    }

    const initialContentOffset = useMemo(() => {
        const initialScroll = state.initialScroll;
        if (!initialScroll) {
            return undefined;
        }

        const resolvedOffset = initialScroll.contentOffset ?? resolveInitialScrollOffset(ctx, initialScroll);
        return usesBootstrapInitialScroll && state.initialScrollSession?.kind === "bootstrap" && Platform.OS === "web"
            ? undefined
            : resolvedOffset;
    }, [usesBootstrapInitialScroll]);

    useLayoutEffect(() => {
        initializeInitialScrollOnMount(ctx, {
            alwaysDispatchInitialScroll: shouldInitializeHorizontalRTL,
            dataLength,
            hasFooterComponent: !!ListFooterComponent,
            initialContentOffset,
            initialScrollAtEnd,
            useBootstrapInitialScroll: usesBootstrapInitialScroll,
        });
    }, []);

    if (isFirstLocal || didDataChangeLocal || state.didColumnsChange) {
        refState.current.lastBatchingAction = Date.now();
        if (!dataSource && !keyExtractorProp && !isFirstLocal && didDataChangeLocal) {
            // If we have no keyExtractor then we have no guarantees about previous item sizes so we have to reset.
            refState.current.sizes.clear();
            refState.current.sizesKnown.clear();
            for (const key in refState.current.averageSizes) {
                delete refState.current.averageSizes[key];
            }
            clearLayoutStoreKnownSizes(ctx);
            refState.current.totalSize = 0;
            set$(ctx, "totalSize", 0);
        }
    }

    if (IS_DEV) {
        useDevChecks(props);
    }

    useLayoutEffect(() => {
        if (shouldResetFreshDataLayout) {
            resetInitialRenderState(ctx, {
                resetInitialScroll: !!initialScrollProp,
                resetLayout: true,
            });
        }
        handleInitialScrollDataChange(ctx, {
            dataLength,
            didDataChange: didDataChangeLocal,
            didStartFreshData: shouldResetFreshDataLayout,
            initialScrollAtEnd,
            latestInitialScroll: initialScrollProp,
            latestInitialScrollSessionKind: initialScrollUsesOffsetOnly ? "offset" : "bootstrap",
            stylePaddingEnd: stylePaddingEndState,
            useBootstrapInitialScroll: usesBootstrapInitialScroll,
        });
    }, [
        dataLength,
        dataKey,
        didDataChangeLocal,
        shouldResetFreshDataLayout,
        initialScrollAtEnd,
        stylePaddingEndState,
        usesBootstrapInitialScroll,
    ]);

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
        horizontal,
        numColumnsProp,
        rtl,
        stylePaddingBottomState,
        stylePaddingLeftState,
        stylePaddingRightState,
    ]);

    useLayoutEffect(() => {
        const previousContentInsetEndAdjustment = previousContentInsetEndAdjustmentRef.current;
        previousContentInsetEndAdjustmentRef.current = contentInsetEndAdjustmentResolved;
        updateContentInsetEndAdjustment(ctx, previousContentInsetEndAdjustment);
    }, [ctx, contentInsetEndAdjustmentResolved]);

    const onLayoutFooter = useCallback(
        (layout: LayoutRectangle) => {
            if (!usesBootstrapInitialScroll) {
                return;
            }

            handleBootstrapInitialScrollFooterLayout(ctx, {
                dataLength,
                footerSize: layout[horizontal ? "width" : "height"],
                initialScrollAtEnd,
                stylePaddingEnd: stylePaddingEndState,
            });
        },
        [dataLength, initialScrollAtEnd, horizontal, stylePaddingEndState, usesBootstrapInitialScroll],
    );

    const onLayoutChange = useCallback(
        (layout: LayoutRectangle, fromLayoutEffect: boolean) => {
            const previousScrollLength = state.scrollLength;
            const previousOtherAxisSize = state.otherAxisSize;
            handleLayout(ctx, layout, setCanRender);
            maybeUpdateAnchoredEndSpace(ctx);
            const didLayoutAffectBootstrapTarget =
                previousScrollLength !== state.scrollLength || previousOtherAxisSize !== state.otherAxisSize;
            if (usesBootstrapInitialScroll && !fromLayoutEffect && didLayoutAffectBootstrapTarget) {
                handleBootstrapInitialScrollLayoutChange(ctx);
            }
            if (usesBootstrapInitialScroll) {
                return;
            }

            advanceCurrentInitialScrollSession(ctx);
        },
        [dataLength, initialScrollAtEnd, stylePaddingEndState, usesBootstrapInitialScroll],
    );

    const { onLayout } = useOnLayoutSync({
        onLayoutChange,
        onLayoutProp,
        ref: refScroller as unknown as React.RefObject<LooseView | null>, // the type of ScrollView doesn't include measure?
    });

    useLayoutEffect(() => {
        if (snapToIndices) {
            updateSnapToOffsets(ctx);
        }
    }, [snapToIndices]);
    useLayoutEffect(
        () => initializeStateVars(true),
        [
            dataKey,
            dataVersion,
            horizontal,
            memoizedLastItemKeys.join(","),
            numColumnsProp,
            nextScrollAxisGap,
            stylePaddingBottomState,
            stylePaddingTopState,
            useAlignItemsAtEndPadding,
        ],
    );

    useLayoutEffect(() => {
        // Get these out of state because react-dom's double render can cause issues when
        // accessing local variables
        const {
            didColumnsChange,
            didDataChange,
            isFirst,
            props: { data },
        } = state;
        const didAllocateContainers = getDataLength(state) > 0 && doInitialAllocateContainers(ctx);
        if (!didAllocateContainers && !isFirst && (didDataChange || didColumnsChange)) {
            checkResetContainers(ctx, data, {
                didColumnsChange,
                previousDataLength: state.dataSourcePreviousLength,
            });
        }
        if (didDataChange) {
            state.dataChangeKeyExtractorChanged = false;
            state.dataSourceNeedsReset = false;
            state.dataSourceAnchorPositions = undefined;
            state.dataSourceMutationApplied = false;
            state.dataSourcePreviousLength = undefined;
            state.dataSourceResetReason = undefined;
            state.pendingDataComparison = undefined;
            state.pendingDataSourceBatches = undefined;
        }
        // Now that it's done, reset the flags
        state.didColumnsChange = false;
        state.didDataChange = false;
        state.isFirst = false;
    }, [dataProp, dataKey, dataSource, dataSourceRevision, dataVersion, horizontal, numColumnsProp, nextScrollAxisGap]);

    useLayoutEffect(() => {
        set$(ctx, "extraData", extraData);
        const didToggleOverride = prevHasOverrideItemLayout.current !== hasOverrideItemLayout;
        prevHasOverrideItemLayout.current = hasOverrideItemLayout;
        if ((hasOverrideItemLayout || didToggleOverride) && numColumnsProp > 1) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }
    }, [extraData, hasOverrideItemLayout, numColumnsProp]);

    useEffect(() => {
        if (!onMetricsChange) {
            return;
        }

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
            for (const unsub of unsubscribe) {
                unsub();
            }
        };
    }, [ctx, onMetricsChange]);

    useEffect(() => {
        const hadViewabilityConsumers = hasViewabilityConsumers(ctx);
        const didViewabilityConfigChange =
            !areViewabilityConfigsEqual(previousViewabilityConfigRef.current, viewabilityConfig) ||
            !areViewabilityConfigPairsEqual(previousViewabilityConfigPairsRef.current, viewabilityConfigCallbackPairs);
        previousViewabilityConfigRef.current = viewabilityConfig;
        previousViewabilityConfigPairsRef.current = viewabilityConfigCallbackPairs;
        const viewability = setupViewability({
            onViewableItemsChanged,
            viewabilityConfig,
            viewabilityConfigCallbackPairs,
        });
        state.viewabilityConfigCallbackPairs = viewability;
        state.enableScrollForNextCalculateItemsInView = true;
        state.scrollForNextCalculateItemsInView = undefined;
        const hasViewabilityConsumersNow = hasViewabilityConsumers(ctx, viewability);
        if (
            (!hadViewabilityConsumers && hasViewabilityConsumersNow) ||
            (didViewabilityConfigChange && (onFirstVisibleItemChanged || hasViewabilityConsumersNow))
        ) {
            requestViewabilityRecalculation(ctx);
        }
    }, [viewabilityConfig, viewabilityConfigCallbackPairs, onViewableItemsChanged]);

    // Needs to use the initial estimated size on old arch, new arch will come within the useLayoutEffect
    useInit(() => {
        if (!IsNewArchitecture) {
            doInitialAllocateContainers(ctx);
        }
    });

    useImperativeHandle(forwardedRef, () => createImperativeHandle(ctx, scheduleImperativeScrollCommit), []);

    useEffect(() => {
        return () => {
            cancelImperativeScroll(state);
            state.scheduledWork.dispose();
        };
    }, [state]);

    // Run pending scroll to end after props have settled.
    useLayoutEffect(() => {
        state.runPendingScrollToEnd?.();
    });

    useEffect(() => {
        if (Platform.OS !== "web" || usesBootstrapInitialScroll) {
            return;
        }

        advanceCurrentInitialScrollSession(ctx);
    }, [ctx, usesBootstrapInitialScroll]);

    const fns = useMemo(
        () => ({
            getRenderedItem: (key: string) => getRenderedItem(ctx, key),
            onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                // This should be handled by checkFinishedScrollFrame in the scroll handler
                // but just in case it doesn't setup the falback
                checkFinishedScrollFallback(ctx);

                if (state.props.onMomentumScrollEnd) {
                    // TODO type this better
                    state.props.onMomentumScrollEnd(event as any);
                }
            },
            onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => onScroll(ctx, event),
            onScrollBeginDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                prepareReachedEdgeForNextUserScroll(ctx);
                state.props.onScrollBeginDrag?.(event as any);
            },
            onScrollEnd: () => prepareReachedEdgeForNextUserScroll(ctx),
        }),
        [],
    );

    const onScrollHandler = useStickyScrollHandler(stickyHeaderIndices, horizontal, ctx, fns.onScroll);
    const refreshControlElement = refreshControl as React.ReactElement<{ progressViewOffset?: number }> | undefined;

    return (
        <>
            <ListComponent
                {...restProps}
                alignItemsAtEnd={alignItemsAtEnd}
                canRender={canRender}
                contentContainerStyle={contentContainerStyle}
                contentInset={contentInset}
                freshDataTransitionEpoch={state.freshDataTransitionEpoch}
                getRenderedItem={fns.getRenderedItem}
                horizontal={horizontal!}
                initialContentOffset={initialContentOffset}
                ListEmptyComponent={dataLength === 0 ? ListEmptyComponent : undefined}
                ListFooterComponent={ListFooterComponent}
                ListFooterComponentStyle={ListFooterComponentStyle}
                ListHeaderComponent={ListHeaderComponent}
                onInternalScrollBeginDrag={fns.onScrollBeginDrag}
                onInternalScrollEnd={fns.onScrollEnd}
                onLayout={onLayout!}
                onLayoutFooter={onLayoutFooter}
                onMomentumScrollEnd={fns.onMomentumScrollEnd}
                onScroll={onScrollHandler}
                recycleItems={recycleItems}
                refreshControl={
                    refreshControlElement
                        ? stylePaddingTopState > 0
                            ? React.cloneElement(refreshControlElement, {
                                  progressViewOffset:
                                      (refreshControlElement.props.progressViewOffset ?? 0) + stylePaddingTopState,
                              })
                            : refreshControlElement
                        : onRefresh && (
                              <RefreshControl
                                  onRefresh={onRefresh}
                                  progressViewOffset={(progressViewOffset || 0) + stylePaddingTopState}
                                  refreshing={!!refreshing}
                              />
                          )
                }
                refScrollView={combinedRef}
                renderScrollComponent={renderScrollComponent}
                scrollAdjustHandler={refState.current?.scrollAdjustHandler}
                scrollEventThrottle={0}
                snapToIndices={snapToIndices}
                stickyHeaderIndices={stickyHeaderIndices}
                style={style}
                useWindowScroll={useWindowScrollResolved}
            />
            {IS_DEV && ENABLE_DEBUG_VIEW && <DebugView />}
        </>
    );
});

function normalizeNumColumnsProp(numColumns: number | undefined) {
    let normalizedNumColumns = numColumns ?? 1;
    if (!Number.isInteger(normalizedNumColumns) || normalizedNumColumns < 1) {
        warnDevOnce(
            "invalid-numColumns",
            `numColumns must be a positive integer. Received ${numColumns}; using 1 instead.`,
        );
        normalizedNumColumns = 1;
    }
    return normalizedNumColumns;
}
