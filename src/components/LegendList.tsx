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
import { cancelImperativeScroll, syncScrollActive } from "@/core/cancelImperativeScroll";
import { interruptUserScroll } from "@/core/cancelScroll";
import { checkFinishedScrollFallback } from "@/core/checkFinishedScroll";
import { checkResetContainers } from "@/core/checkResetContainers";
import { checkStructuralDataChange } from "@/core/checkStructuralDataChange";
import { getContentInsetTop } from "@/core/clampScrollOffset";
import { invalidateContainerMeasurements, invalidateFixedItemSizes } from "@/core/containerItemMetadata";
import { resetContainerLayoutReady } from "@/core/containerLayoutReady";
import { applyDataSourceMutationBatches } from "@/core/DataSourceMutationCoordinator";
import { DataSourceObserver } from "@/core/DataSourceObserver";
import { doInitialAllocateContainers } from "@/core/doInitialAllocateContainers";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { doScrollTo } from "@/core/doScrollTo";
import { getEndAlignedViewOffset } from "@/core/endOfContentTarget";
import { clearPreservedInitialScrollTarget } from "@/core/finishInitialScroll";
import { finishMaintainScrollAtEnd } from "@/core/finishMaintainScrollAtEnd";
import { handleLayout } from "@/core/handleLayout";
import { getDataLength, type IndexedData, resolveIndexedData } from "@/core/IndexedData";
import { advanceCurrentInitialScrollSession, resolveInitialScrollOffset } from "@/core/initialScroll";
import { handleInitialScrollDataChange, initializeInitialScrollOnMount } from "@/core/initialScrollLifecycle";
import { restoreItemSizeEstimates, saveItemSizeEstimates } from "@/core/itemSizeCache";
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
import { scrollTo } from "@/core/scrollTo";
import { scrollToEnd } from "@/core/scrollToEnd";
import { maybeUpdateAnchoredEndSpace } from "@/core/updateAnchoredEndSpace";
import { updateContentInsetEndAdjustment } from "@/core/updateContentInsetEndAdjustment";
import { updateContentMetricsState } from "@/core/updateContentMetricsState";
import { updateScroll } from "@/core/updateScroll";
import { armUserScrollSettle, settleUserScroll } from "@/core/userMomentum";
import { useWrapIfItem } from "@/core/useWrapIfItem";
import {
    areViewabilityConfigsEqual,
    hasViewabilityConsumers,
    recordViewabilityInteraction,
    requestViewabilityRecalculation,
    resetViewabilityTimers,
    setupViewability,
} from "@/core/viewability";
import { useCombinedRef } from "@/hooks/useCombinedRef";
import { useInit } from "@/hooks/useInit";
import { useOnLayoutSync } from "@/hooks/useOnLayoutSync";
import { getWindowSize } from "@/platform/getWindowSize";
import { Platform } from "@/platform/Platform";
import type { LayoutRectangle, NativeScrollEvent, NativeSyntheticEvent } from "@/platform/platform-types";
import { RefreshControl } from "@/platform/RefreshControl";
import { StyleSheet } from "@/platform/StyleSheet";
import { subscribeScreenReader } from "@/platform/screenReader";
import type { LooseScrollView, LooseScrollViewProps, LooseView, ViewStyle } from "@/platform/scrollview-types";
import { useStickyScrollHandler } from "@/platform/useStickyScrollHandler";
import { getContentSize } from "@/state/getContentSize";
import { listen$, peek$, StateProvider, set$, useStateContext } from "@/state/state";
import type {
    LegendListDataSource,
    LegendListMetrics,
    LegendListRef,
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
import { checkThresholds } from "@/utils/checkThresholds";
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
        props: LegendListPropsBase<T, LooseScrollViewProps> & { scrollElement?: HTMLElement | null },
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
    scrollElement?: HTMLElement | null;
    childrenMode?: boolean;
    data: ReadonlyArray<T>;
    dataSource?: LegendListDataSource<T>;
    renderItem: (props: any) => React.ReactNode;
};

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

function shouldIgnoreTransientMacOSScrollMeasurement({
    horizontal,
    layout,
    usesBootstrapInitialScroll,
}: {
    horizontal: boolean | undefined;
    layout: LayoutRectangle;
    usesBootstrapInitialScroll: boolean;
}) {
    if (Platform.OS !== "macos" || !usesBootstrapInitialScroll) {
        return false;
    }
    const scrollAxis = horizontal ? "width" : "height";
    const otherAxis = horizontal ? "height" : "width";
    const measuredLength = layout[scrollAxis];
    const measuredOtherAxisLength = layout[otherAxis];
    const windowLength = getWindowSize()[scrollAxis];

    // Fabric can report padding- or content-sized bounds during bootstrap.
    // These are not viewport measurements and would disable virtualization.
    return (
        (Number.isFinite(measuredOtherAxisLength) && measuredOtherAxisLength <= 0) ||
        (Number.isFinite(measuredLength) &&
            Number.isFinite(windowLength) &&
            windowLength > 0 &&
            measuredLength > windowLength + 1)
    );
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const LegendListInner = typedForwardRef(function LegendListInner<T>(
    props: LegendListInnerProps<T>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    useEffect(subscribeScreenReader, []);
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
        experimental_hideItemsUntilMeasured,
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
        onUserScroll,
        onLayout: onLayoutProp,
        onLoad,
        onReady,
        onMomentumScrollBegin,
        onMomentumScrollEnd,
        onRefresh,
        onScroll: onScrollProp,
        onScrollBeginDrag,
        onScrollEndDrag,
        onStartReached,
        onStartReachedThreshold = 0.5,
        onStickyHeaderChange,
        onFirstVisibleItemChanged,
        onViewableItemsChanged,
        progressViewOffset,
        recycleItems = false,
        refreshControl,
        refreshing,
        showImmediately = false,
        refScrollView,
        renderScrollComponent,
        renderItem,
        scrollEventThrottle,
        snapToIndices,
        stickyHeaderIndices: stickyHeaderIndicesProp,
        style: styleProp,
        useWindowScroll = false,
        scrollElement,
        viewabilityConfig,
        viewabilityConfigCallbackPairs,
        ...rest
    } = props;
    const numColumnsProp = normalizeNumColumnsProp(numColumnsPropRaw);

    const keyExtractor = useMemo(
        () =>
            dataSource
                ? (_item: T, index: number) => dataSource.getKey(index)
                : (keyExtractorProp ?? ((_item: T, index: number) => index.toString())),
        [dataSource, keyExtractorProp],
    );
    const wrappedKeyExtractor = useWrapIfItem(keyExtractor);
    const indexedDataRef = useRef<IndexedData<T> | undefined>(undefined);
    const indexedData = resolveIndexedData(indexedDataRef.current, dataProp, dataSource, wrappedKeyExtractor);
    indexedDataRef.current = indexedData;
    const dataLength = indexedData.getLength();
    const dataSourceRevision = dataSource?.getRevision();

    const animatedPropsInternal = (props as any).animatedPropsInternal as StylesAsSharedValue<LooseScrollViewProps>;
    const {
        anchoredEndSpaceOwnerInternal,
        contentExtentComponentInternal,
        hasItemLayoutAnimationInternal,
        positionComponentInternal,
        stickyPositionComponentInternal,
        ...restProps
    } = rest as typeof rest &
        Pick<
            InternalState["props"],
            | "contentExtentComponentInternal"
            | "hasItemLayoutAnimationInternal"
            | "positionComponentInternal"
            | "stickyPositionComponentInternal"
        > & { anchoredEndSpaceOwnerInternal?: AnchoredEndSpaceOwner };
    const anchoredEndSpaceOwner = anchoredEndSpaceOwnerInternal ?? "list";

    const contentContainerStyleBase = StyleSheet.flatten(contentContainerStyleProp) as ViewStyle | undefined;
    const useAlignItemsAtEndPadding =
        alignItemsAtEnd && !horizontal && contentContainerStyleBase?.minHeight == null && dataLength > 0;
    const shouldFlexGrow =
        alignItemsAtEnd &&
        !useAlignItemsAtEndPadding &&
        (horizontal ? contentContainerStyleBase?.minWidth == null : contentContainerStyleBase?.minHeight == null);
    const contentContainerMinSizeStyle = horizontal
        ? contentContainerStyleBase?.minWidth
        : contentContainerStyleBase?.minHeight;
    const contentContainerMinSize =
        typeof contentContainerMinSizeStyle === "number" && Number.isFinite(contentContainerMinSizeStyle)
            ? contentContainerMinSizeStyle
            : undefined;
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
    const initialInsetTop = Platform.OS === "ios" && !horizontal ? Math.max(0, contentInset?.top ?? 0) : 0;
    const initialScrollUsesOffsetOnly =
        !initialScrollAtEnd &&
        !hasInitialScrollIndex &&
        (hasInitialScrollOffset || shouldInitializeHorizontalRTL || initialInsetTop > 0);
    const usesBootstrapInitialScroll = initialScrollAtEnd || hasInitialScrollIndex;
    const shouldBottomAlignNumericInitialScrollIndex =
        typeof initialScrollIndexProp === "number" &&
        !hasInitialScrollOffset &&
        dataLength > 1 &&
        initialScrollIndexProp >= dataLength - 1;
    const initialScrollProp: InternalState["initialScroll"] = initialScrollAtEnd
        ? {
              index: Math.max(0, dataLength - 1),
              kind: "end",
              preserveForBottomPadding: true,
              viewOffset: getEndAlignedViewOffset(stylePaddingEndState),
              viewPosition: 1,
          }
        : hasInitialScrollIndex
          ? typeof initialScrollIndexProp === "object"
              ? {
                    index: initialScrollIndexProp.index ?? 0,
                    preserveForBottomPadding:
                        initialScrollIndexProp.viewOffset === undefined &&
                        initialScrollIndexProp.viewPosition === 1 &&
                        initialScrollIndexProp.viewPositionFallback === undefined
                            ? true
                            : undefined,
                    viewOffset:
                        initialScrollIndexProp.viewOffset ??
                        (initialScrollIndexProp.viewPosition === 1 &&
                        initialScrollIndexProp.viewPositionFallback === undefined
                            ? getEndAlignedViewOffset(stylePaddingEndState)
                            : 0),
                    viewPosition: initialScrollIndexProp.viewPosition ?? 0,
                    viewPositionFallback: initialScrollIndexProp.viewPositionFallback,
                }
              : {
                    index: initialScrollIndexProp ?? 0,
                    preserveForBottomPadding: shouldBottomAlignNumericInitialScrollIndex ? true : undefined,
                    viewOffset:
                        initialScrollOffsetProp ??
                        (shouldBottomAlignNumericInitialScrollIndex
                            ? getEndAlignedViewOffset(stylePaddingEndState)
                            : 0),
                    viewPosition: shouldBottomAlignNumericInitialScrollIndex ? 1 : undefined,
                }
          : initialScrollUsesOffsetOnly
            ? {
                  contentOffset: initialScrollOffsetProp ?? -initialInsetTop,
                  index: 0,
                  viewOffset: 0,
              }
            : undefined;

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
        dataLength,
        dataSourceRevision,
        dataKey,
        dataVersion,
        keyExtractor,
    ]);

    const scrollElementResolved = Platform.OS === "web" && !renderScrollComponent ? scrollElement : undefined;
    const useWindowScrollResolved =
        Platform.OS === "web" && !!useWindowScroll && scrollElementResolved === undefined && !renderScrollComponent;

    const hasExternalScroll = useWindowScrollResolved || scrollElementResolved !== undefined;

    const refState = useRef<InternalState | undefined>(undefined);
    const sizeCacheOwnerRef = useRef<object | undefined>(undefined);
    // Separator measurements depend on tail membership; keep them instance-local.
    sizeCacheOwnerRef.current = props.ItemSeparatorComponent ? undefined : (keyExtractorProp ?? dataProp);
    const hasOverrideItemLayout = !!overrideItemLayout;
    const prevHasOverrideItemLayout = useRef(hasOverrideItemLayout);

    if (!refState.current) {
        // Saving the state onto the context avoids recreating this twice in strict mode,
        // which can cause all sorts of issues because all our functions expect it to be created once.
        if (!ctx.state) {
            const shouldEstimateInitialLayout = IsNewArchitecture && showImmediately;
            const initialScrollLength = (estimatedListSize ??
                (IsNewArchitecture && !shouldEstimateInitialLayout ? { height: 0, width: 0 } : getWindowSize()))[
                horizontal ? "width" : "height"
            ];
            const hasEstimatedInitialLayout =
                shouldEstimateInitialLayout && Number.isFinite(initialScrollLength) && initialScrollLength > 0;
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
                endBuffered: -1,
                endNoBuffer: -1,
                endReachedSnapshot: undefined,
                firstFullyOnScreenIndex: -1,
                freshDataTransitionEpoch: 0,
                handledDataChangeEpoch: 0,
                handledFreshDataTransitionEpoch: 0,
                hasEstimatedInitialLayout,
                hasHadNonEmptyData: dataLength > 0,
                idCache: [],
                idsInView: [],
                indexByKey: new Map(),
                indexedData,
                initialScroll: initialScrollProp
                    ? {
                          ...initialScrollProp,
                          kind: initialScrollAtEnd ? "end" : initialScrollUsesOffsetOnly ? "offset" : "index",
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
                scrollLength: shouldEstimateInitialLayout && !hasEstimatedInitialLayout ? 0 : initialScrollLength,
                scrollPending: 0,
                scrollProcessingEnabled: true,
                scrollTime: 0,
                sizes: new Map(),
                sizesKnown: new Map(),
                startBuffered: -1,
                startNoBuffer: -1,
                startReachedSnapshot: undefined,
                stickyContainerPool: new Set(),
                stickyContainers: new Map(),
                totalSize: 0,
                viewabilityConfigCallbackPairs: undefined as never,
            };

            const internalState = ctx.state;
            // Late-bind these commands so lower-level scroll modules can call back up without import cycles.
            ctx.doMaintainScrollAtEnd = () => doMaintainScrollAtEnd(ctx);
            ctx.doScrollTo = (params) => doScrollTo(ctx, params);
            ctx.interruptUserScroll = () => interruptUserScroll(ctx);
            ctx.scrollTo = (params) => scrollTo(ctx, params);
            ctx.scrollToEnd = (options) => scrollToEnd(ctx, options);
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
    const [canRender, setCanRender] = React.useState(!IsNewArchitecture || !!state.hasEstimatedInitialLayout);
    const previousViewabilityConfigRef = useRef(viewabilityConfig);
    const previousViewabilityConfigPairsRef = useRef(viewabilityConfigCallbackPairs);
    const isFirstLocal = state.isFirst;
    const didDataSourceChangeLocal = state.props.dataSource !== dataSource;
    if (didDataSourceChangeLocal) {
        invalidateContainerMeasurements(state);
        resetViewabilityTimers(ctx);
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
    const previousHideItemsUntilMeasured = state.props.hideItemsUntilMeasured;
    const didScrollAxisChange = !isFirstLocal && state.props.horizontal !== !!horizontal;
    const committedNumColumns = peek$(ctx, "numColumns");
    const didScrollAxisGapChange = !isFirstLocal && ctx.scrollAxisGap !== nextScrollAxisGap;
    const wrappedGetFixedItemSize = useWrapIfItem(getFixedItemSize);
    const wrappedGetItemType = useWrapIfItem(getItemType);

    ctx.scrollAxisGap = nextScrollAxisGap;
    state.didColumnsChange = numColumnsProp !== committedNumColumns || didScrollAxisChange || didScrollAxisGapChange;
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
        state.initialScrollAnchor?.viewPosition === 1 &&
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
    const dataChangeEpoch = state.dataChangeEpoch;
    const freshDataTransitionEpoch = state.freshDataTransitionEpoch;
    const throttleScrollFn = useThrottledOnScroll(onScrollProp, scrollEventThrottle ?? 0);
    const didAnchoredEndSpaceAnchorIndexChange =
        !isFirstLocal &&
        !didDataChangeLocal &&
        state.props.anchoredEndSpace?.anchorIndex !== anchoredEndSpace?.anchorIndex;
    const shouldExactSyncLayoutStore =
        !isFirstLocal &&
        !didDataChangeLocal &&
        (state.props.estimatedItemSize !== estimatedItemSize ||
            !!state.props.hasReliableKeyExtractor !== (!!dataSource || !!keyExtractorProp) ||
            didScrollAxisChange ||
            didScrollAxisGapChange);

    const wrappedGetItemType = useWrapIfItem(getItemType);
    const wrappedKeyExtractor = useWrapIfItem(keyExtractor);
    if (
        didDataReferenceChangeLocal ||
        state.props.getItemType !== wrappedGetItemType ||
        state.props.itemsAreEqual !== itemsAreEqual ||
        state.props.keyExtractor !== wrappedKeyExtractor
    ) {
        state.containerSyncAdjust = undefined;
    }

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
        contentContainerMinSize,
        contentExtentComponentInternal,
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
        hasExternalScroll,
        hasItemLayoutAnimationInternal,
        hideItemsUntilMeasured: experimental_hideItemsUntilMeasured,
        hasReliableKeyExtractor: !!dataSource || !!keyExtractorProp,
        hideItemsUntilMeasured: experimental_hideItemsUntilMeasured,
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
        onMetricsChange,
        onMomentumScrollBegin,
        onMomentumScrollEnd,
        onReady,
        onScroll: throttleScrollFn,
        onScrollBeginDrag,
        onScrollEndDrag,
        onStartReached,
        onStartReachedThreshold,
        onStickyHeaderChange,
        onUserScroll,
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
                            invalidateContainerMeasurements(state);
                            resetViewabilityTimers(ctx);
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
                    invalidateContainerMeasurements(state);
                    resetViewabilityTimers(ctx);
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

    if (didDataChangeLocal && !isFirstLocal) {
        // Child layout effects can measure before the parent's data-change effect.
        // Keep their key lookup on the same dataset as state.props.data.
        state.previousIndexByKey ??= state.indexByKey;
        state.indexByKey = new Map();
        state.idCache.length = dataProp.length;
        for (let index = 0; index < dataProp.length; index++) {
            state.indexByKey.set(getId(state, index), index);
        }
    }

    state.refScroller = refScroller as unknown as React.RefObject<LegendListScrollerRef | null>;

    if (!isFirstLocal && previousAdaptiveRender && !experimental_adaptiveRender) {
        resetAdaptiveRender(ctx);
    }
    if (!isFirstLocal && previousHideItemsUntilMeasured && !experimental_hideItemsUntilMeasured) {
        resetContainerLayoutReady(ctx);
    }
    const memoizedLastItemKeys = useMemo(() => {
        if (!dataLength) return [];
        return Array.from({ length: Math.min(numColumnsProp, dataLength) }, (_, i) => getId(state, dataLength - 1 - i));
    }, [dataLength, dataProp, dataKey, dataSource, dataSourceRevision, dataVersion, numColumnsProp]);

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
            // Scroll can overscroll the start if being animated and that can break the pendingDiff.
            // The start is the -contentInset.top resting offset, not native zero.
            const distanceFromStart = state.scroll + getContentInsetTop(ctx);
            if (distanceFromStart < 0) {
                paddingDiff += distanceFromStart;
            }

            requestAdjust(ctx, paddingDiff);
        }
    };

    if (isFirstLocal) {
        initializeStateVars(false);
        resetLayoutCachesForDataChange(state);
        restoreItemSizeEstimates(ctx, estimatedListSize?.[horizontal ? "height" : "width"], sizeCacheOwnerRef.current);
        if ((state.initialScroll && state.initialScroll.kind !== "offset") || snapToIndices?.length) {
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
        return usesBootstrapInitialScroll &&
            !!state.initialScroll &&
            state.initialScroll.kind !== "offset" &&
            Platform.OS === "web"
            ? undefined
            : resolvedOffset;
    }, [usesBootstrapInitialScroll]);

    // Re-arm lifecycle ownership before layout effects can request scroll work.
    useLayoutEffect(() => {
        state.isUnmounted = false;
        if (state.userScrollContentSize !== undefined || state.isMomentumScrolling) armUserScrollSettle(ctx);
        return () => {
            saveItemSizeEstimates(ctx, sizeCacheOwnerRef.current);
            state.isUnmounted = true;
            state.maintainingScrollAtEnd = undefined;
            state.pendingMaintainScrollAtEnd = false;
            cancelImperativeScroll(state);
            syncScrollActive(ctx);
            resetViewabilityTimers(ctx);
            state.scheduledWork.dispose();
        };
    }, [ctx, state]);

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
        // Data-change detection updates shared state during render, and React may restart that render
        // before committing effects. Consume monotonic epochs so the committed render cannot lose the change.
        const didDataChange = state.handledDataChangeEpoch !== dataChangeEpoch;
        const didStartFreshData = state.handledFreshDataTransitionEpoch !== freshDataTransitionEpoch;
        state.handledDataChangeEpoch = dataChangeEpoch;
        state.handledFreshDataTransitionEpoch = freshDataTransitionEpoch;

        if (didStartFreshData) {
            resetInitialRenderState(ctx, {
                resetInitialScroll: !!initialScrollProp,
                resetLayout: true,
            });
        }
        if (didDataChange) {
            restoreItemSizeEstimates(
                ctx,
                state.lastLayout?.[horizontal ? "height" : "width"] ??
                    estimatedListSize?.[horizontal ? "height" : "width"],
                sizeCacheOwnerRef.current,
            );
        }
        handleInitialScrollDataChange(ctx, {
            dataLength,
            didDataChange,
            didStartFreshData,
            initialScrollAtEnd,
            latestInitialScroll: initialScrollProp,
            latestInitialScrollSessionKind: initialScrollAtEnd
                ? "end"
                : initialScrollUsesOffsetOnly
                  ? "offset"
                  : "index",
            stylePaddingEnd: stylePaddingEndState,
            useBootstrapInitialScroll: usesBootstrapInitialScroll,
        });
    }, [
        dataLength,
        dataKey,
        dataChangeEpoch,
        freshDataTransitionEpoch,
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
        anchoredEndSpaceOwner,
        contentInset?.bottom,
        contentInset?.left,
        contentInset?.right,
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
            if (shouldIgnoreTransientMacOSScrollMeasurement({ horizontal, layout, usesBootstrapInitialScroll })) {
                return;
            }
            const previousScrollLength = state.scrollLength;
            const previousOtherAxisSize = state.otherAxisSize;
            const hadEstimatedInitialLayout = state.hasEstimatedInitialLayout;
            handleLayout(ctx, layout, setCanRender);
            maybeUpdateAnchoredEndSpace(ctx);
            const didLayoutAffectBootstrapTarget =
                previousScrollLength !== state.scrollLength || previousOtherAxisSize !== state.otherAxisSize;
            if (
                usesBootstrapInitialScroll &&
                ((hadEstimatedInitialLayout && !state.hasEstimatedInitialLayout) ||
                    (!fromLayoutEffect && didLayoutAffectBootstrapTarget))
            ) {
                handleBootstrapInitialScrollLayoutChange(ctx);
            }
            if (usesBootstrapInitialScroll) {
                return;
            }

            advanceCurrentInitialScrollSession(ctx);
        },
        [dataLength, horizontal, initialScrollAtEnd, stylePaddingEndState, usesBootstrapInitialScroll],
    );

    const { onLayout } = useOnLayoutSync({
        onLayoutChange,
        onLayoutProp,
        ref: refScroller as unknown as React.RefObject<LooseView | null>, // the type of ScrollView doesn't include measure?
        webExternalScroll: hasExternalScroll,
    });

    useLayoutEffect(() => {
        if (snapToIndices) {
            updateSnapToOffsets(ctx);
        }
    }, [snapToIndices]);
    useLayoutEffect(
        () => initializeStateVars(true),
        [
            contentInset?.bottom,
            contentInset?.top,
            dataKey,
            dataVersion,
            horizontal,
            memoizedLastItemKeys,
            numColumnsProp,
            nextScrollAxisGap,
            stylePaddingBottomState,
            stylePaddingTopState,
            useAlignItemsAtEndPadding,
        ],
    );

    // UIKit leaves contentOffset alone when contentInset changes, so a list resting at its
    // start would end up under (or away from) a new top inset. Keep it at the new start.
    const previousContentInsetTop = useRef(contentInset?.top);
    useLayoutEffect(() => {
        const prevTop = Math.max(0, previousContentInsetTop.current ?? 0);
        const didChange = previousContentInsetTop.current !== contentInset?.top;
        previousContentInsetTop.current = contentInset?.top;
        if (
            didChange &&
            Platform.OS === "ios" &&
            !horizontal &&
            !state.contentInsetOverride &&
            !state.isDragging &&
            !state.isMomentumScrolling
        ) {
            const offset = -getContentInsetTop(ctx);
            if (
                !state.didFinishInitialScroll &&
                !initialScrollAtEnd &&
                !hasInitialScrollIndex &&
                !hasInitialScrollOffset &&
                state.initialScroll?.kind === "offset" &&
                state.initialScroll &&
                (!state.scrollingTo || state.scrollingTo.isInitialScroll)
            ) {
                state.initialScroll.contentOffset = offset;
                advanceCurrentInitialScrollSession(ctx, { forceScroll: true });
            } else if (state.didFinishInitialScroll && !state.scrollingTo && Math.abs(state.scroll + prevTop) < 1) {
                scrollTo(ctx, { animated: false, offset });
            }
        }
    }, [contentInset?.top]);

    useLayoutEffect(() => {
        checkThresholds(ctx);
    }, [maintainScrollAtEndThreshold]);

    useLayoutEffect(() => {
        if (!maintainScrollAtEndConfig) {
            finishMaintainScrollAtEnd(ctx);
        } else if (peek$(ctx, "isFollowingEnd")) {
            doMaintainScrollAtEnd(ctx);
        }
    }, [!!maintainScrollAtEndConfig]);

    const previousAlwaysRenderIndices = useRef(alwaysRenderIndices);
    useLayoutEffect(() => {
        const previousPins = previousAlwaysRenderIndices.current;
        const didPinsChange =
            previousPins.set.size !== alwaysRenderIndices.set.size ||
            previousPins.arr.some((index) => !alwaysRenderIndices.set.has(index));
        previousAlwaysRenderIndices.current = alwaysRenderIndices;
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
        if (didPinsChange && !didDataChange && !didColumnsChange && !isFirst) {
            state.scrollForNextCalculateItemsInView = undefined;
            calculateItemsInView(ctx);
        }
        if (didDataChange) {
            state.dataChangeKeyExtractorChanged = false;
            state.dataSourceNeedsReset = false;
            state.dataSourceAnchorPositions = undefined;
            state.dataSourceMutationApplied = false;
            state.dataSourcePreviousLength = undefined;
            state.dataSourceResetReason = undefined;
            state.pendingDataComparison = undefined;
            state.previousIndexByKey = undefined;
            state.pendingDataSourceBatches = undefined;
        }
        // Now that it's done, reset the flags
        state.didColumnsChange = false;
        state.didDataChange = false;
        state.isFirst = false;
    }, [dataProp, dataKey, dataSource, dataSourceRevision, dataVersion, horizontal, numColumnsProp, nextScrollAxisGap, alwaysRenderIndices.arr.join(",")]);

    const previousGetFixedItemSize = useRef(getFixedItemSize);
    useLayoutEffect(() => {
        const hadFixedItemSize = !!previousGetFixedItemSize.current;
        previousGetFixedItemSize.current = getFixedItemSize;
        if (!isFirstLocal && (getFixedItemSize || hadFixedItemSize)) {
            // Re-resolve fixed sizes while preserving measured sizes and rendered estimates.
            invalidateFixedItemSizes(state);
            state.containerSyncAdjust = undefined;
            state.scrollForNextCalculateItemsInView = undefined;
            state.triggerCalculateItemsInView?.({ doMVCP: true, forceFullItemPositions: true });
            if (state.props.maintainScrollAtEnd?.onItemLayout) doMaintainScrollAtEnd(ctx);
        }
    }, [!!getFixedItemSize, extraData]);

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

        // Read the latest callback so an inline callback does not resubscribe and re-emit every render.
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
                state.props.onMetricsChange?.(metrics);
            }
        };

        emitMetrics();

        const unsubscribe = [listen$(ctx, "headerSize", emitMetrics), listen$(ctx, "footerSize", emitMetrics)];

        return () => {
            for (const unsub of unsubscribe) {
                unsub();
            }
        };
    }, [ctx, !!onMetricsChange]);

    useEffect(() => {
        const hadViewabilityConsumers = hasViewabilityConsumers(ctx);
        const didViewabilityConfigChange =
            !areViewabilityConfigsEqual(previousViewabilityConfigRef.current, viewabilityConfig) ||
            !areViewabilityConfigPairsEqual(previousViewabilityConfigPairsRef.current, viewabilityConfigCallbackPairs);
        previousViewabilityConfigRef.current = viewabilityConfig;
        previousViewabilityConfigPairsRef.current = viewabilityConfigCallbackPairs;
        const viewability = setupViewability(
            { onViewableItemsChanged, viewabilityConfig, viewabilityConfigCallbackPairs },
            ctx,
        );
        state.viewabilityConfigCallbackPairs = viewability;
        state.scrollForNextCalculateItemsInView = undefined;
        const hasViewabilityConsumersNow = hasViewabilityConsumers(ctx, viewability);
        if (didViewabilityConfigChange || (!hadViewabilityConsumers && hasViewabilityConsumersNow)) {
            resetViewabilityTimers(ctx);
        }
        if (
            (!hadViewabilityConsumers && hasViewabilityConsumersNow) ||
            (didViewabilityConfigChange && (onFirstVisibleItemChanged || hasViewabilityConsumersNow))
        ) {
            requestViewabilityRecalculation(ctx);
        }
    }, [viewabilityConfig, viewabilityConfigCallbackPairs, onViewableItemsChanged]);

    useInit(() => {
        if (!IsNewArchitecture || state.hasEstimatedInitialLayout) {
            doInitialAllocateContainers(ctx);
        }
    });

    useImperativeHandle(forwardedRef, () => createImperativeHandle(ctx, scheduleImperativeScrollCommit), []);

    useEffect(() => {
        // An idle list needs a new visibility deadline after Strict Mode effect replay.
        if (hasViewabilityConsumers(ctx)) requestViewabilityRecalculation(ctx);
    }, [ctx]);

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
            getRenderedItem: (key: string, containerId: number, onReadIndex?: () => void) =>
                getRenderedItem(ctx, key, containerId, onReadIndex),
            onMomentumScrollBegin: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                state.isMomentumScrolling = true;
                set$(ctx, "isScrollActive", true);
                armUserScrollSettle(ctx);
                state.props.onMomentumScrollBegin?.(event as any);
            },
            onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                onScroll(ctx, event, false);
                settleUserScroll(ctx);
                // This should be handled by checkFinishedScrollFrame in the scroll handler
                // but just in case it doesn't setup the falback
                checkFinishedScrollFallback(ctx);

                state.props.onMomentumScrollEnd?.(event as any);
            },
            onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => onScroll(ctx, event),
            onScrollBeginDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                state.isMomentumScrolling = false;
                state.userScrollContentSize = undefined;
                state.scheduledWork.cancel("endFollowRearm");
                state.isDragging = true;
                recordViewabilityInteraction(ctx);
                interruptUserScroll(ctx);
                state.props.onUserScroll?.();
                prepareReachedEdgeForNextUserScroll(ctx);
                state.props.onScrollBeginDrag?.(event as any);
            },
            onScrollEnd: () => prepareReachedEdgeForNextUserScroll(ctx),
            onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                onScroll(ctx, event, false);
                state.isDragging = false;
                syncScrollActive(ctx);
                // Suspend from release through momentum, including delayed or missing pairs.
                state.userScrollContentSize = getContentSize(ctx);
                armUserScrollSettle(ctx);
                state.props.onScrollEndDrag?.(event as any);
            },
        }),
        [],
    );

    const scrollHandler = useStickyScrollHandler(stickyHeaderIndices, horizontal, ctx, fns.onScroll, combinedRef);
    const refreshControlElement = refreshControl as React.ReactElement<{ progressViewOffset?: number }> | undefined;

    return (
        <>
            <ListComponent
                {...restProps}
                alignItemsAtEnd={alignItemsAtEnd}
                autoscrollToTopThreshold={
                    typeof maintainVisibleContentPositionProp === "object"
                        ? maintainVisibleContentPositionProp?.autoscrollToTopThreshold
                        : undefined
                }
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
                onInternalScrollEndDrag={fns.onScrollEndDrag}
                onLayout={onLayout!}
                onLayoutFooter={onLayoutFooter}
                onMomentumScrollBegin={fns.onMomentumScrollBegin}
                onMomentumScrollEnd={fns.onMomentumScrollEnd}
                onScroll={scrollHandler.onScroll}
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
                refScrollView={scrollHandler.refScrollView}
                renderScrollComponent={renderScrollComponent}
                scrollAdjustHandler={refState.current?.scrollAdjustHandler}
                scrollElement={scrollElementResolved}
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
