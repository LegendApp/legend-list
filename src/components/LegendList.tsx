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
import { ENABLE_DEBUG_VIEW } from "@/constants";
import { IsNewArchitecture } from "@/constants-platform";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { checkActualChange } from "@/core/checkActualChange";
import { checkFinishedScrollFallback } from "@/core/checkFinishedScroll";
import { checkResetContainers } from "@/core/checkResetContainers";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { doInitialAllocateContainers } from "@/core/doInitialAllocateContainers";
import { handleLayout } from "@/core/handleLayout";
import { onScroll } from "@/core/onScroll";
import { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import { scrollTo } from "@/core/scrollTo";
import { updateItemPositions } from "@/core/updateItemPositions";
import { updateItemSize } from "@/core/updateItemSize";
import { useWrapIfItem } from "@/core/useWrapIfItem";
import { setupViewability } from "@/core/viewability";
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
    InternalState,
    LegendListMetrics,
    LegendListPropsBase,
    LegendListRef,
    LegendListRenderItemProps,
    LegendListScrollerRef,
    ScrollIndexWithOffset,
    ScrollIndexWithOffsetAndContentOffset,
} from "@/types.base";
import { typedForwardRef, typedMemo } from "@/types.base";
import type { StylesAsSharedValue } from "@/typesInternal";
import { createColumnWrapperStyle } from "@/utils/createColumnWrapperStyle";
import { createImperativeHandle } from "@/utils/createImperativeHandle";
import { IS_DEV } from "@/utils/devEnvironment";
import { getAlwaysRenderIndices } from "@/utils/getAlwaysRenderIndices";
import { getId } from "@/utils/getId";
import { getRenderedItem } from "@/utils/getRenderedItem";
import { extractPadding, isArray, warnDevOnce } from "@/utils/helpers";
import { normalizeMaintainScrollAtEnd } from "@/utils/normalizeMaintainScrollAtEnd";
import { normalizeMaintainVisibleContentPosition } from "@/utils/normalizeMaintainVisibleContentPosition";
import { requestAdjust } from "@/utils/requestAdjust";
import { setInitialRenderState } from "@/utils/setInitialRenderState";
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
        const { children, data: dataProp, renderItem: renderItemProp, ...restProps } = props;
        const isChildrenMode = children !== undefined && dataProp === undefined;

        const processedProps = isChildrenMode
            ? {
                  ...restProps,
                  childrenMode: true,
                  data: (isArray(children) ? children : React.Children.toArray(children)).flat(1) as T[],
                  renderItem: ({ item }: { item: T }) => item as React.ReactNode,
              }
            : {
                  ...restProps,
                  data: dataProp || [],
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
    data: ReadonlyArray<T>;
    renderItem:
        | ((props: LegendListRenderItemProps<T, string | undefined>) => React.ReactNode)
        | React.ComponentType<LegendListRenderItemProps<T, string | undefined>>;
};

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const LegendListInner = typedForwardRef(function LegendListInner<T>(
    props: LegendListInnerProps<T>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const {
        alignItemsAtEnd = false,
        alwaysRender,
        columnWrapperStyle,
        contentContainerStyle: contentContainerStyleProp,
        contentInset,
        data: dataProp = [],
        dataVersion,
        drawDistance = 250,
        estimatedItemSize = 100,
        estimatedListSize,
        extraData,
        getEstimatedItemSize,
        getFixedItemSize,
        getItemType,
        horizontal,
        initialContainerPoolRatio = 2,
        initialScrollAtEnd = false,
        initialScrollIndex: initialScrollIndexProp,
        initialScrollOffset: initialScrollOffsetProp,
        itemsAreEqual,
        keyExtractor: keyExtractorProp,
        ListEmptyComponent,
        ListHeaderComponent,
        maintainScrollAtEnd = false,
        maintainScrollAtEndThreshold = 0.1,
        maintainVisibleContentPosition: maintainVisibleContentPositionProp,
        numColumns: numColumnsProp = 1,
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
        onStartReached,
        onStartReachedThreshold = 0.5,
        onStickyHeaderChange,
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
        stickyIndices: stickyIndicesDeprecated, // TODOV3: Remove from v3 release
        style: styleProp,
        suggestEstimatedItemSize,
        useWindowScroll = false,
        viewabilityConfig,
        viewabilityConfigCallbackPairs,
        waitForInitialLayout = true,
        ...rest
    } = props;

    const animatedPropsInternal = (props as any).animatedPropsInternal as StylesAsSharedValue<LooseScrollViewProps>;
    const positionComponentInternal = (props as any).positionComponentInternal as React.ComponentType<any> | undefined;
    const stickyPositionComponentInternal = (props as any).stickyPositionComponentInternal as
        | React.ComponentType<any>
        | undefined;
    const {
        childrenMode,
        positionComponentInternal: _positionComponentInternal,
        stickyPositionComponentInternal: _stickyPositionComponentInternal,
        ...restProps
    } = rest as any;

    const contentContainerStyleBase = StyleSheet.flatten(contentContainerStyleProp) as ViewStyle | undefined;
    const shouldFlexGrow =
        alignItemsAtEnd &&
        (horizontal ? contentContainerStyleBase?.minWidth == null : contentContainerStyleBase?.minHeight == null);
    const contentContainerStyle: ViewStyle = {
        ...contentContainerStyleBase,
        ...(alignItemsAtEnd
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
    const maintainScrollAtEndConfig = normalizeMaintainScrollAtEnd(maintainScrollAtEnd);
    const maintainVisibleContentPositionConfig = normalizeMaintainVisibleContentPosition(
        maintainVisibleContentPositionProp,
    );

    const hasInitialScrollIndex = initialScrollIndexProp !== undefined && initialScrollIndexProp !== null;
    const hasInitialScrollOffset = initialScrollOffsetProp !== undefined && initialScrollOffsetProp !== null;
    const initialScrollUsesOffsetOnly = !initialScrollAtEnd && !hasInitialScrollIndex && hasInitialScrollOffset;
    const initialScrollProp: ScrollIndexWithOffsetAndContentOffset | undefined = initialScrollAtEnd
        ? { index: Math.max(0, dataProp.length - 1), viewOffset: -stylePaddingBottomState, viewPosition: 1 }
        : hasInitialScrollIndex
          ? typeof initialScrollIndexProp === "object"
              ? {
                    index: initialScrollIndexProp.index ?? 0,
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
    ctx.columnWrapperStyle =
        columnWrapperStyle || (contentContainerStyle ? createColumnWrapperStyle(contentContainerStyle) : undefined);

    const refScroller = useRef<LooseScrollView>(null);
    const combinedRef = useCombinedRef(refScroller, refScrollView);
    const didFinishInitialScrollRef = useRef(false);
    const initialScrollRetryWindowUntilRef = useRef(0);
    const initialScrollRetryLastLengthRef = useRef<number | undefined>(undefined);
    const lastInitialScrollTargetRef = useRef<ScrollIndexWithOffsetAndContentOffset | undefined>(initialScrollProp);
    const lastInitialScrollTargetUsesOffsetRef = useRef(initialScrollUsesOffsetOnly);
    const keyExtractor = keyExtractorProp ?? ((_item: T, index: number) => index.toString());
    const stickyHeaderIndices = stickyHeaderIndicesProp ?? stickyIndicesDeprecated;
    const alwaysRenderIndices = useMemo(() => {
        const indices = getAlwaysRenderIndices(alwaysRender, dataProp, keyExtractor);
        return { arr: indices, set: new Set(indices) };
    }, [
        alwaysRender?.top,
        alwaysRender?.bottom,
        alwaysRender?.indices?.join(","),
        alwaysRender?.keys?.join(","),
        dataProp,
        dataVersion,
        keyExtractor,
    ]);

    if (IS_DEV && stickyIndicesDeprecated && !stickyHeaderIndicesProp) {
        warnDevOnce(
            "stickyIndices",
            "stickyIndices has been renamed to stickyHeaderIndices. Please update your props to use stickyHeaderIndices.",
        );
    }

    if (IS_DEV && useWindowScroll && renderScrollComponent) {
        warnDevOnce(
            "useWindowScrollRenderScrollComponent",
            "useWindowScroll is not supported when renderScrollComponent is provided.",
        );
    }

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

            ctx.state = {
                activeStickyIndex: -1,
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
                initialAnchor:
                    !initialScrollUsesOffsetOnly &&
                    initialScrollProp?.index !== undefined &&
                    initialScrollProp?.viewPosition !== undefined
                        ? {
                              attempts: 0,
                              index: initialScrollProp.index,
                              settledTicks: 0,
                              viewOffset: initialScrollProp.viewOffset ?? 0,
                              viewPosition: initialScrollProp.viewPosition,
                          }
                        : undefined,
                initialNativeScrollWatchdog: undefined,
                initialScroll: initialScrollProp,
                initialScrollUsesOffset: initialScrollUsesOffsetOnly,
                isAtEnd: false,
                isAtStart: false,
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
                pendingNativeMVCPAdjust: undefined,
                positions: [],
                props: {} as any,
                queuedCalculateItemsInView: 0,
                refScroller: { current: null } as React.RefObject<LegendListScrollerRef | null>,
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
                timeoutSizeMessage: 0,
                timeouts: new Set(),
                totalSize: 0,
                viewabilityConfigCallbackPairs: undefined as never,
            };

            const internalState = ctx.state;
            internalState.triggerCalculateItemsInView = (params) => calculateItemsInView(ctx, params);

            set$(ctx, "maintainVisibleContentPosition", maintainVisibleContentPositionConfig);
            set$(ctx, "extraData", extraData);
        }
        refState.current = ctx.state;
    }

    const state = refState.current!;
    const isFirstLocal = state.isFirst;

    state.didColumnsChange = numColumnsProp !== state.props.numColumns;
    const didDataReferenceChangeLocal = state.props.data !== dataProp;
    const didDataVersionChangeLocal = state.props.dataVersion !== dataVersion;
    const didDataChangeLocal =
        didDataVersionChangeLocal ||
        (didDataReferenceChangeLocal && checkActualChange(state, dataProp, state.props.data));
    if (didDataChangeLocal) {
        state.dataChangeEpoch += 1;
        state.dataChangeNeedsScrollUpdate = true;
        state.didDataChange = true;
        state.previousData = state.props.data;
    }
    const throttleScrollFn =
        scrollEventThrottle && onScrollProp ? useThrottledOnScroll(onScrollProp, scrollEventThrottle) : onScrollProp;

    state.props = {
        alignItemsAtEnd,
        alwaysRender,
        alwaysRenderIndicesArr: alwaysRenderIndices.arr,
        alwaysRenderIndicesSet: alwaysRenderIndices.set,
        animatedProps: animatedPropsInternal,
        contentInset,
        data: dataProp,
        dataVersion,
        drawDistance,
        estimatedItemSize,
        getEstimatedItemSize: useWrapIfItem(getEstimatedItemSize),
        getFixedItemSize: useWrapIfItem(getFixedItemSize),
        getItemType: useWrapIfItem(getItemType),
        horizontal: !!horizontal,
        initialContainerPoolRatio,
        itemsAreEqual,
        keyExtractor: useWrapIfItem(keyExtractor),
        maintainScrollAtEnd: maintainScrollAtEndConfig,
        maintainScrollAtEndThreshold,
        maintainVisibleContentPosition: maintainVisibleContentPositionConfig,
        numColumns: numColumnsProp,
        onEndReached,
        onEndReachedThreshold,
        onItemSizeChanged,
        onLoad,
        onScroll: throttleScrollFn,
        onStartReached,
        onStartReachedThreshold,
        onStickyHeaderChange,
        overrideItemLayout,
        positionComponentInternal,
        recycleItems: !!recycleItems,
        renderItem: renderItem!,
        snapToIndices,
        stickyIndicesArr: stickyHeaderIndices ?? [],
        stickyIndicesSet: useMemo(() => new Set(stickyHeaderIndices ?? []), [stickyHeaderIndices?.join(",")]),
        stickyPositionComponentInternal,
        stylePaddingBottom: stylePaddingBottomState,
        stylePaddingTop: stylePaddingTopState,
        suggestEstimatedItemSize: !!suggestEstimatedItemSize,
        useWindowScroll: useWindowScrollResolved,
    };

    state.refScroller = refScroller as unknown as React.RefObject<LegendListScrollerRef | null>;

    const memoizedLastItemKeys = useMemo(() => {
        if (!dataProp.length) return [];
        return Array.from({ length: Math.min(numColumnsProp, dataProp.length) }, (_, i) =>
            getId(state, dataProp.length - 1 - i),
        );
    }, [dataProp, dataVersion, numColumnsProp]);

    // Run first time and whenever data changes
    const initializeStateVars = (shouldAdjustPadding: boolean) => {
        set$(ctx, "lastItemKeys", memoizedLastItemKeys);
        set$(ctx, "numColumns", numColumnsProp);

        // If the stylePaddingTop has changed, scroll to an adjusted offset to
        // keep the same content in view
        const prevPaddingTop = peek$(ctx, "stylePaddingTop");
        setPaddingTop(ctx, { stylePaddingTop: stylePaddingTopState });
        refState.current!.props.stylePaddingBottom = stylePaddingBottomState;

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
        updateItemPositions(ctx, /*dataChanged*/ true);
    }

    const resolveInitialScrollOffset = useCallback((initialScroll: ScrollIndexWithOffset) => {
        if (state.initialScrollUsesOffset) {
            return clampScrollOffset(ctx, (initialScroll as ScrollIndexWithOffsetAndContentOffset).contentOffset ?? 0);
        }
        const baseOffset = initialScroll.index !== undefined ? calculateOffsetForIndex(ctx, initialScroll.index) : 0;
        const resolvedOffset = calculateOffsetWithOffsetPosition(ctx, baseOffset, initialScroll);
        return clampScrollOffset(ctx, resolvedOffset, initialScroll);
    }, []);

    const finishInitialScrollWithoutScroll = useCallback(() => {
        refState.current!.initialAnchor = undefined;
        refState.current!.initialScroll = undefined;
        state.initialAnchor = undefined;
        state.initialScroll = undefined;
        state.initialScrollUsesOffset = false;
        lastInitialScrollTargetRef.current = undefined;
        lastInitialScrollTargetUsesOffsetRef.current = false;
        setInitialRenderState(ctx, { didInitialScroll: true });
    }, []);

    const shouldFinishInitialScrollAtOrigin = useCallback(
        (initialScroll: ScrollIndexWithOffsetAndContentOffset, offset: number) => {
            if (offset !== 0 || initialScrollAtEnd) {
                return false;
            }

            if (state.initialScrollUsesOffset) {
                return Math.abs(initialScroll.contentOffset ?? 0) <= 1;
            }

            return (
                initialScroll.index === 0 &&
                (initialScroll.viewPosition ?? 0) === 0 &&
                Math.abs(initialScroll.viewOffset ?? 0) <= 1
            );
        },
        [initialScrollAtEnd],
    );

    const shouldFinishEmptyInitialScrollAtEnd = useCallback(
        (initialScroll: ScrollIndexWithOffsetAndContentOffset, offset: number) => {
            return dataProp.length === 0 && initialScrollAtEnd && offset === 0 && initialScroll.viewPosition === 1;
        },
        [dataProp.length, initialScrollAtEnd],
    );

    const initialContentOffset = useMemo(() => {
        let value: number;
        const { initialScroll, initialAnchor } = refState.current!;
        if (initialScroll) {
            if (
                !state.initialScrollUsesOffset &&
                !IsNewArchitecture &&
                initialScroll.index !== undefined &&
                (!initialAnchor || initialAnchor?.index !== initialScroll.index)
            ) {
                refState.current!.initialAnchor = {
                    attempts: 0,
                    index: initialScroll.index,
                    settledTicks: 0,
                    viewOffset: initialScroll.viewOffset ?? 0,
                    viewPosition: initialScroll.viewPosition,
                };
            }

            if (initialScroll.contentOffset !== undefined) {
                value = initialScroll.contentOffset;
            } else {
                const clampedOffset = resolveInitialScrollOffset(initialScroll);

                const updatedInitialScroll = { ...initialScroll, contentOffset: clampedOffset };
                refState.current!.initialScroll = updatedInitialScroll;
                state.initialScroll = updatedInitialScroll;
                lastInitialScrollTargetRef.current = updatedInitialScroll;
                lastInitialScrollTargetUsesOffsetRef.current = state.initialScrollUsesOffset;

                value = clampedOffset;
            }
        } else {
            refState.current!.initialAnchor = undefined;
            value = 0;
        }

        const hasPendingDataDependentInitialScroll =
            !!initialScroll &&
            dataProp.length === 0 &&
            !shouldFinishInitialScrollAtOrigin(initialScroll, value) &&
            !shouldFinishEmptyInitialScrollAtEnd(initialScroll, value);
        if (!value && !hasPendingDataDependentInitialScroll) {
            if (initialScroll && shouldFinishInitialScrollAtOrigin(initialScroll, value)) {
                finishInitialScrollWithoutScroll();
            } else {
                setInitialRenderState(ctx, { didInitialScroll: true });
            }
        }

        return value;
    }, []);

    if (isFirstLocal || didDataChangeLocal || numColumnsProp !== peek$(ctx, "numColumns")) {
        refState.current.lastBatchingAction = Date.now();
        if (!keyExtractorProp && !isFirstLocal && didDataChangeLocal) {
            IS_DEV &&
                !childrenMode &&
                warnDevOnce(
                    "keyExtractor",
                    "Changing data without a keyExtractor can cause slow performance and resetting scroll. If your list data can change you should use a keyExtractor with a unique id for best performance and behavior.",
                );
            // If we have no keyExtractor then we have no guarantees about previous item sizes so we have to reset
            refState.current.sizes.clear();
            refState.current.positions.length = 0;
            refState.current.totalSize = 0;
            set$(ctx, "totalSize", 0);
        }
    }

    const doInitialScroll = useCallback((options?: { allowPostFinishRetry?: boolean }) => {
        const allowPostFinishRetry = !!options?.allowPostFinishRetry;
        const { didFinishInitialScroll, queuedInitialLayout, scrollingTo } = state;
        const initialScroll =
            state.initialScroll ?? (allowPostFinishRetry ? lastInitialScrollTargetRef.current : undefined);
        const isInitialScrollInProgress = !!scrollingTo?.isInitialScroll;
        const needsContainerLayoutForInitialScroll = !state.initialScrollUsesOffset;
        const shouldWaitForInitialLayout =
            waitForInitialLayout &&
            needsContainerLayoutForInitialScroll &&
            !queuedInitialLayout &&
            !allowPostFinishRetry &&
            !isInitialScrollInProgress;
        if (
            !initialScroll ||
            shouldWaitForInitialLayout ||
            (didFinishInitialScroll && !allowPostFinishRetry) ||
            (scrollingTo && !isInitialScrollInProgress)
        ) {
            return;
        }

        if (allowPostFinishRetry && lastInitialScrollTargetUsesOffsetRef.current) {
            return;
        }

        const didMoveAwayFromInitialTarget =
            allowPostFinishRetry &&
            initialScroll.contentOffset !== undefined &&
            Math.abs(state.scroll - initialScroll.contentOffset) > 1;
        if (didMoveAwayFromInitialTarget) {
            initialScrollRetryWindowUntilRef.current = 0;
            return;
        }

        const offset = resolveInitialScrollOffset(initialScroll);
        const didOffsetChange =
            initialScroll.contentOffset === undefined || Math.abs(initialScroll.contentOffset - offset) > 1;
        if (!didOffsetChange && (isInitialScrollInProgress || allowPostFinishRetry)) {
            return;
        }

        if (didOffsetChange) {
            const updatedInitialScroll = { ...initialScroll, contentOffset: offset };
            if (!state.initialScrollUsesOffset) {
                lastInitialScrollTargetRef.current = updatedInitialScroll;
                lastInitialScrollTargetUsesOffsetRef.current = false;
                if (state.initialScroll) {
                    refState.current!.initialScroll = updatedInitialScroll;
                    state.initialScroll = updatedInitialScroll;
                }
            }
        }

        const hasMeasuredScrollLayout = !!state.lastLayout && state.scrollLength > 0;
        const shouldForceNativeInitialScroll =
            (state.initialScrollUsesOffset && hasMeasuredScrollLayout) ||
            allowPostFinishRetry || !!queuedInitialLayout || (isInitialScrollInProgress && didOffsetChange);
        scrollTo(ctx, {
            animated: false,
            forceScroll: shouldForceNativeInitialScroll,
            index: state.initialScrollUsesOffset ? undefined : initialScroll.index,
            isInitialScroll: true,
            offset,
            precomputedWithViewOffset: true,
        });
    }, []);

    useLayoutEffect(() => {
        if (
            !state.initialScroll ||
            !state.initialScrollUsesOffset ||
            state.didFinishInitialScroll ||
            !state.queuedInitialLayout ||
            dataProp.length === 0
        ) {
            return;
        }

        doInitialScroll();
    }, [dataProp.length, doInitialScroll]);

    useLayoutEffect(() => {
        if (!initialScrollAtEnd) {
            return;
        }

        const lastIndex = Math.max(0, dataProp.length - 1);
        const initialScroll = state.initialScroll;
        const shouldRearmFinishedEmptyInitialScrollAtEnd = !!(
            state.didFinishInitialScroll &&
            dataProp.length > 0 &&
            initialScroll &&
            !state.initialScrollUsesOffset &&
            initialScroll.index === 0 &&
            initialScroll.viewPosition === 1 &&
            (initialScroll.contentOffset ?? 0) === 0
        );
        if (state.didFinishInitialScroll && !shouldRearmFinishedEmptyInitialScrollAtEnd) {
            return;
        }

        if (shouldRearmFinishedEmptyInitialScrollAtEnd) {
            state.didFinishInitialScroll = false;
        }

        if (
            initialScroll &&
            !state.initialScrollUsesOffset &&
            initialScroll.index === lastIndex &&
            initialScroll.viewPosition === 1 &&
            !shouldRearmFinishedEmptyInitialScrollAtEnd
        ) {
            return;
        }

        const updatedInitialScroll: ScrollIndexWithOffsetAndContentOffset = {
            contentOffset: undefined,
            index: lastIndex,
            viewOffset: initialScroll?.viewOffset ?? -stylePaddingBottomState,
            viewPosition: 1,
        };

        state.initialScrollUsesOffset = false;
        lastInitialScrollTargetRef.current = updatedInitialScroll;
        lastInitialScrollTargetUsesOffsetRef.current = false;
        refState.current!.initialScroll = updatedInitialScroll;
        state.initialScroll = updatedInitialScroll;
        if (!IsNewArchitecture) {
            state.initialAnchor = {
                attempts: 0,
                index: lastIndex,
                settledTicks: 0,
                viewOffset: updatedInitialScroll.viewOffset ?? 0,
                viewPosition: 1,
            };
        }

        doInitialScroll();
    }, [dataProp.length, initialScrollAtEnd, stylePaddingBottomState]);

    const onLayoutFooter = useCallback(
        (layout: LayoutRectangle) => {
            if (!initialScrollAtEnd) {
                return;
            }

            const { initialScroll } = state;
            if (!initialScroll) {
                return;
            }

            const lastIndex = Math.max(0, dataProp.length - 1);
            if (initialScroll.index !== lastIndex || initialScroll.viewPosition !== 1) {
                return;
            }

            const footerSize = layout[horizontal ? "width" : "height"];
            const viewOffset = -stylePaddingBottomState - footerSize;

            if (initialScroll.viewOffset !== viewOffset) {
                const previousTargetOffset = initialScroll.contentOffset ?? resolveInitialScrollOffset(initialScroll);
                const didMoveAwayFromFinishedInitialTarget =
                    state.didFinishInitialScroll && Math.abs(state.scroll - previousTargetOffset) > 1;
                if (didMoveAwayFromFinishedInitialTarget) {
                    return;
                }

                const updatedInitialScroll = { ...initialScroll, viewOffset };
                state.initialScrollUsesOffset = false;
                lastInitialScrollTargetRef.current = updatedInitialScroll;
                lastInitialScrollTargetUsesOffsetRef.current = false;
                refState.current!.initialScroll = updatedInitialScroll;
                state.initialScroll = updatedInitialScroll;
                if (state.didFinishInitialScroll) {
                    state.didFinishInitialScroll = false;
                }
                doInitialScroll();
            }
        },
        [
            dataProp.length,
            doInitialScroll,
            horizontal,
            initialScrollAtEnd,
            resolveInitialScrollOffset,
            stylePaddingBottomState,
        ],
    );

    const onLayoutChange = useCallback((layout: LayoutRectangle) => {
        handleLayout(ctx, layout, setCanRender);

        const SCROLL_LENGTH_RETRY_WINDOW_MS = 600;
        const now = Date.now();
        const didFinishInitialScroll = !!state.didFinishInitialScroll;
        if (didFinishInitialScroll && !didFinishInitialScrollRef.current) {
            initialScrollRetryWindowUntilRef.current = now + SCROLL_LENGTH_RETRY_WINDOW_MS;
        }
        didFinishInitialScrollRef.current = didFinishInitialScroll;

        const previousScrollLength = initialScrollRetryLastLengthRef.current;
        const currentScrollLength = state.scrollLength;
        const didScrollLengthChange =
            previousScrollLength === undefined || Math.abs(currentScrollLength - previousScrollLength) > 1;

        if (didScrollLengthChange) {
            initialScrollRetryLastLengthRef.current = currentScrollLength;
        }

        if (
            didFinishInitialScroll &&
            didScrollLengthChange &&
            now <= initialScrollRetryWindowUntilRef.current &&
            !lastInitialScrollTargetUsesOffsetRef.current &&
            lastInitialScrollTargetRef.current?.index !== undefined
        ) {
            doInitialScroll({ allowPostFinishRetry: true });
            return;
        }

        doInitialScroll();
    }, []);

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
    useLayoutEffect(() => {
        // Get these out of state because react-dom's double render can cause issues when
        // accessing local variables
        const {
            didColumnsChange,
            didDataChange,
            isFirst,
            props: { data },
        } = state;
        const didAllocateContainers = data.length > 0 && doInitialAllocateContainers(ctx);
        if (!didAllocateContainers && !isFirst && (didDataChange || didColumnsChange)) {
            checkResetContainers(ctx, data);
        }
        // Now that it's done, reset the flags
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

    useLayoutEffect(
        () => initializeStateVars(true),
        [dataVersion, memoizedLastItemKeys.join(","), numColumnsProp, stylePaddingBottomState, stylePaddingTopState],
    );

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
        const viewability = setupViewability({
            onViewableItemsChanged,
            viewabilityConfig,
            viewabilityConfigCallbackPairs,
        });
        state.viewabilityConfigCallbackPairs = viewability;
        state.enableScrollForNextCalculateItemsInView = !viewability;
    }, [viewabilityConfig, viewabilityConfigCallbackPairs, onViewableItemsChanged]);

    if (!IsNewArchitecture) {
        // Needs to use the initial estimated size on old arch, new arch will come within the useLayoutEffect
        useInit(() => {
            doInitialAllocateContainers(ctx);
        });
    }

    useImperativeHandle(forwardedRef, () => createImperativeHandle(ctx), []);

    if (Platform.OS === "web") {
        useEffect(doInitialScroll, []);
    }

    const fns = useMemo(
        () => ({
            getRenderedItem: (key: string) => getRenderedItem(ctx, key),
            onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                // This should be handled by checkFinishedScrollFrame in the scroll handler
                // but just in case it doesn't setup the falback
                checkFinishedScrollFallback(ctx);

                if (onMomentumScrollEnd) {
                    // TODO type this better
                    onMomentumScrollEnd(event as any);
                }
            },
            onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => onScroll(ctx, event),
            updateItemSize: (itemKey: string, sizeObj: { width: number; height: number }) =>
                updateItemSize(ctx, itemKey, sizeObj),
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
                getRenderedItem={fns.getRenderedItem}
                horizontal={horizontal!}
                initialContentOffset={initialContentOffset}
                ListEmptyComponent={dataProp.length === 0 ? ListEmptyComponent : undefined}
                ListHeaderComponent={ListHeaderComponent}
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
                updateItemSize={fns.updateItemSize}
                useWindowScroll={useWindowScrollResolved}
                waitForInitialLayout={waitForInitialLayout}
            />
            {IS_DEV && ENABLE_DEBUG_VIEW && <DebugView state={refState.current!} />}
        </>
    );
});
