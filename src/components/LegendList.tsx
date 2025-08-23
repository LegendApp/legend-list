import * as React from "react";
import {
    type ForwardedRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { createAnimatedEvent } from "@/platform/AnimatedValue";
import { Dimensions, type LayoutChangeEvent, type LayoutRectangle, StyleSheet } from "@/platform/Layout";
import { Platform } from "@/platform/Platform";
// Note: ScrollView type import not used directly on web
import type { WebViewMethods } from "@/platform/View";

// These types are still needed from react-native but we'll define them
interface NativeSyntheticEvent<T> {
    nativeEvent: T;
}

interface NativeScrollEvent {
    contentOffset: { x: number; y: number };
    contentSize: { width: number; height: number };
    layoutMeasurement: { width: number; height: number };
}

// RefreshControl - for now we'll create a simple web version or skip it
const RefreshControl = ({ onRefresh, refreshing, progressViewOffset }: any) => {
    if (typeof onRefresh !== "function") return null;
    return (
        <button
            onClick={onRefresh}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onRefresh();
            }}
            style={{
                alignItems: "center",
                display: "flex",
                height: 40,
                justifyContent: "center",
                marginTop: progressViewOffset || 0,
            }}
            type="button"
        >
            {refreshing ? "Refreshing..." : "Pull to refresh"}
        </button>
    );
};

import { DebugView } from "@/components/DebugView";
import { ListComponent } from "@/components/ListComponent";
import { ENABLE_DEBUG_VIEW, IsNewArchitecture } from "@/constants";
import { scheduleCalculateItemsInView } from "@/core/calculateItemsInView";
import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { doInitialAllocateContainers } from "@/core/doInitialAllocateContainers";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { finishScrollTo } from "@/core/finishScrollTo";
import { handleLayout } from "@/core/handleLayout";
import { onScroll } from "@/core/onScroll";
import { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import { scrollTo } from "@/core/scrollTo";
import { scrollToIndex } from "@/core/scrollToIndex";
import { updateAllPositions } from "@/core/updateAllPositions";
import { updateItemSize } from "@/core/updateItemSize";
import { setupViewability } from "@/core/viewability";
import { useCombinedRef } from "@/hooks/useCombinedRef";
import { useInit } from "@/hooks/useInit";
import { peek$, StateProvider, set$, useStateContext } from "@/state/state";
import type {
    InternalState,
    LegendListProps,
    LegendListRef,
    LegendListRenderItemProps,
    MaintainScrollAtEndOptions,
    ScrollIndexWithOffset,
    ScrollState,
} from "@/types";
import { typedForwardRef, typedMemo } from "@/types";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { checkAtTop } from "@/utils/checkAtTop";
import { createColumnWrapperStyle } from "@/utils/createColumnWrapperStyle";
import { getId } from "@/utils/getId";
import { getRenderedItem } from "@/utils/getRenderedItem";
import { extractPadding, isArray, warnDevOnce } from "@/utils/helpers";
import { requestAdjust } from "@/utils/requestAdjust";
import { setPaddingTop } from "@/utils/setPaddingTop";
import { useThrottledOnScroll } from "@/utils/throttledOnScroll";
import { updateAveragesOnDataChange } from "@/utils/updateAveragesOnDataChange";
import { updateSnapToOffsets } from "@/utils/updateSnapToOffsets";

const DEFAULT_DRAW_DISTANCE = 250;
const DEFAULT_ITEM_SIZE = 100;

export const LegendList = typedMemo(
    typedForwardRef(function LegendList<T>(props: LegendListProps<T>, forwardedRef: ForwardedRef<LegendListRef>) {
        // Handle children mode - convert children to data array at the top level
        const { children, data: dataProp, renderItem: renderItemProp, ...restProps } = props;
        const isChildrenMode = children !== undefined && dataProp === undefined;

        const processedProps = isChildrenMode
            ? {
                  ...restProps,
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

type LegendListInnerProps<T> = Omit<LegendListProps<T>, "children"> & {
    data: ReadonlyArray<T>;
    renderItem:
        | ((props: LegendListRenderItemProps<T, string | undefined>) => React.ReactNode)
        | React.ComponentType<LegendListRenderItemProps<T, string | undefined>>;
};

const LegendListInner = typedForwardRef(function LegendListInner<T>(
    props: LegendListInnerProps<T>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const {
        alignItemsAtEnd = false,
        columnWrapperStyle,
        contentContainerStyle: contentContainerStyleProp,
        data: dataProp = [],
        drawDistance = 250,
        enableAverages = true,
        estimatedItemSize: estimatedItemSizeProp,
        estimatedListSize,
        extraData,
        getEstimatedItemSize,
        getFixedItemSize,
        getItemType,
        horizontal,
        initialContainerPoolRatio = 2,
        initialScrollIndex: initialScrollIndexProp,
        initialScrollOffset: initialScrollOffsetProp,
        itemsAreEqual,
        keyExtractor: keyExtractorProp,
        ListEmptyComponent,
        ListHeaderComponent,
        maintainScrollAtEnd = false,
        maintainScrollAtEndThreshold = 0.1,
        maintainVisibleContentPosition = true,
        numColumns: numColumnsProp = 1,
        onEndReached,
        onEndReachedThreshold = 0.5,
        onItemSizeChanged,
        onLayout: onLayoutProp,
        onLoad,
        onMomentumScrollEnd,
        onRefresh,
        onScroll: onScrollProp,
        onStartReached,
        onStartReachedThreshold = 0.5,
        onViewableItemsChanged,
        progressViewOffset,
        recycleItems = false,
        refreshControl,
        refreshing,
        refScrollView,
        renderItem,
        scrollEventThrottle,
        snapToIndices,
        stickyIndices,
        style: styleProp,
        suggestEstimatedItemSize,
        viewabilityConfig,
        viewabilityConfigCallbackPairs,
        waitForInitialLayout = true,
        ...rest
    } = props;

    const [renderNum, setRenderNum] = useState(0);
    const initialScroll: ScrollIndexWithOffset | undefined =
        initialScrollIndexProp || initialScrollOffsetProp
            ? typeof initialScrollIndexProp === "object"
                ? { index: initialScrollIndexProp.index || 0, viewOffset: initialScrollIndexProp.viewOffset || 0 }
                : { index: initialScrollIndexProp || 0, viewOffset: initialScrollOffsetProp || 0 }
            : undefined;

    const [canRender, setCanRender] = React.useState(!IsNewArchitecture);

    const contentContainerStyle = { ...StyleSheet.flatten(contentContainerStyleProp) };
    const style = { ...StyleSheet.flatten(styleProp) };
    const stylePaddingTopState = extractPadding(style, contentContainerStyle, "Top");
    const stylePaddingBottomState = extractPadding(style, contentContainerStyle, "Bottom");

    const ctx = useStateContext();
    ctx.columnWrapperStyle =
        columnWrapperStyle || (contentContainerStyle ? createColumnWrapperStyle(contentContainerStyle) : undefined);

    const refScroller = useRef<HTMLDivElement & WebViewMethods>(null);
    // The underlying platform ScrollView ref merges into the web div methods
    const combinedRef = useCombinedRef<any>(refScroller as any, refScrollView as any);
    const estimatedItemSize = estimatedItemSizeProp ?? DEFAULT_ITEM_SIZE;
    const scrollBuffer = (drawDistance ?? DEFAULT_DRAW_DISTANCE) || 1;
    const keyExtractor = keyExtractorProp ?? ((_item, index) => index.toString());

    const refState = useRef<InternalState>();

    if (!refState.current) {
        // Saving the state onto the context avoids recreating this twice in strict mode,
        // which can cause all sorts of issues because all our functions expect it to be created once.
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
                enableScrollForNextCalculateItemsInView: true,
                endBuffered: -1,
                endNoBuffer: -1,
                endReachedBlockedByTimer: false,
                firstFullyOnScreenIndex: -1,
                idCache: new Map(),
                idsInView: [],
                indexByKey: new Map(),
                initialScroll,
                isAtEnd: false,
                isAtStart: false,
                isCalculating: false,
                isEndReached: false,
                isStartReached: false,
                lastBatchingAction: Date.now(),
                lastLayout: undefined,
                loadStartTime: Date.now(),
                minIndexSizeChanged: 0,
                nativeMarginTop: 0,
                pendingAdjust: 0,
                positions: new Map(),
                props: {} as any,
                queuedCalculateItemsInView: 0,
                queuedItemSizeUpdates: [] as { itemKey: string; sizeObj: { width: number; height: number } }[],
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

    const didDataChange = state.props.data !== dataProp;
    const throttleScrollFn =
        scrollEventThrottle && onScrollProp ? useThrottledOnScroll(onScrollProp, scrollEventThrottle) : onScrollProp;

    state.props = {
        alignItemsAtEnd,
        data: dataProp,
        enableAverages,
        estimatedItemSize,
        getEstimatedItemSize,
        getFixedItemSize,
        getItemType,
        horizontal: !!horizontal,
        initialContainerPoolRatio,
        initialScroll,
        itemsAreEqual,
        keyExtractor,
        maintainScrollAtEnd,
        maintainScrollAtEndThreshold,
        maintainVisibleContentPosition,
        numColumns: numColumnsProp,
        onEndReached,
        onEndReachedThreshold,
        onItemSizeChanged,
        onLoad,
        onScroll: throttleScrollFn,
        onStartReached,
        onStartReachedThreshold,
        recycleItems: !!recycleItems,
        renderItem: renderItem!,
        scrollBuffer,
        snapToIndices,
        stickyIndicesArr: stickyIndices ?? [],
        stickyIndicesSet: useMemo(() => new Set(stickyIndices ?? []), [stickyIndices?.join(",")]),
        stylePaddingBottom: stylePaddingBottomState,
        stylePaddingTop: stylePaddingTopState,
        suggestEstimatedItemSize: !!suggestEstimatedItemSize,
    };

    state.refScroller = refScroller as any;

    const checkResetContainers = (isFirst: boolean) => {
        const state = refState.current;
        if (state) {
            // Preserve averages for items that are considered equal before updating data
            if (!isFirst && state.props.data !== dataProp) {
                updateAveragesOnDataChange(state, state.props.data, dataProp);
            }

            state.props.data = dataProp;

            if (!isFirst) {
                scheduleCalculateItemsInView(ctx, state, { dataChanged: true, doMVCP: true });

                const shouldMaintainScrollAtEnd =
                    maintainScrollAtEnd === true || (maintainScrollAtEnd as MaintainScrollAtEndOptions).onDataChange;

                const didMaintainScrollAtEnd = shouldMaintainScrollAtEnd && doMaintainScrollAtEnd(ctx, state, false);

                // Reset the endReached flag if new data has been added and we didn't
                // just maintain the scroll at end
                if (!didMaintainScrollAtEnd && dataProp.length > state.props.data.length) {
                    state.isEndReached = false;
                }

                if (!didMaintainScrollAtEnd) {
                    checkAtTop(state);
                    checkAtBottom(ctx, state);
                }
            }
        }
    };

    const memoizedLastItemKeys = useMemo(() => {
        if (!dataProp.length) return [];
        return Array.from({ length: Math.min(numColumnsProp, dataProp.length) }, (_, i) =>
            getId(state, dataProp.length - 1 - i),
        );
    }, [dataProp, numColumnsProp]);

    // Run first time and whenever data changes
    const initializeStateVars = () => {
        set$(ctx, "lastItemKeys", memoizedLastItemKeys);
        set$(ctx, "numColumns", numColumnsProp);

        // If the stylePaddingTop has changed, scroll to an adjusted offset to
        // keep the same content in view
        const prevPaddingTop = peek$(ctx, "stylePaddingTop");
        setPaddingTop(ctx, state, { stylePaddingTop: stylePaddingTopState });
        refState.current!.props.stylePaddingBottom = stylePaddingBottomState;

        let paddingDiff = stylePaddingTopState - prevPaddingTop;
        // If the style padding has changed then adjust the paddingTop and update scroll to compensate
        // Only iOS seems to need the scroll compensation (ignored on web)
        if (maintainVisibleContentPosition && paddingDiff && prevPaddingTop !== undefined && Platform.OS === "ios") {
            // Scroll can be negative if being animated and that can break the pendingDiff
            if (state.scroll < 0) {
                paddingDiff += state.scroll;
            }
            requestAdjust(ctx, state, paddingDiff);
        }
    };

    if (isFirst) {
        initializeStateVars();
        updateAllPositions(ctx, state);
    }
    const initialContentOffset = useMemo(() => {
        if (initialScroll) {
            const { index, viewOffset } = initialScroll;
            let initialContentOffset = viewOffset || 0;
            if (index !== undefined) {
                initialContentOffset += calculateOffsetForIndex(ctx, state, index);
            }
            refState.current!.isStartReached =
                initialContentOffset < refState.current!.scrollLength * onStartReachedThreshold!;

            if (initialContentOffset > 0) {
                scrollTo(state, { animated: false, index, offset: initialContentOffset });
            }

            return initialContentOffset;
        }
        return 0;
    }, [renderNum]);

    if (isFirst || didDataChange || numColumnsProp !== peek$(ctx, "numColumns")) {
        state.lastBatchingAction = Date.now();
        if (!keyExtractorProp && !isFirst && didDataChange) {
            __DEV__ &&
                warnDevOnce(
                    "keyExtractor",
                    "Changing data without a keyExtractor can cause slow performance and resetting scroll. If your list data can change you should use a keyExtractor with a unique id for best performance and behavior.",
                );
            // If we have no keyExtractor then we have no guarantees about previous item sizes so we have to reset
            state.sizes.clear();
            state.positions.clear();
        }
    }

    const onLayoutHeader = useCallback((rect: LayoutRectangle, fromLayoutEffect: boolean) => {
        const size = rect[horizontal ? "width" : "height"];
        set$(ctx, "headerSize", size);

        if (initialScroll?.index !== undefined) {
            if (IsNewArchitecture && Platform.OS !== "android") {
                if (fromLayoutEffect) {
                    setRenderNum((v) => v + 1);
                }
            } else {
                setTimeout(() => {
                    scrollToIndex(ctx, state, { ...initialScroll, animated: false });
                }, 17);
            }
        }
    }, []);

    useLayoutEffect(() => {
        if (snapToIndices) {
            updateSnapToOffsets(ctx, state);
        }
    }, [snapToIndices]);
    useLayoutEffect(() => {
        const didAllocateContainers = doInitialAllocateContainersCallback();
        if (!didAllocateContainers) {
            checkResetContainers(/*isFirst*/ isFirst);
        }
    }, [dataProp, numColumnsProp]);

    useLayoutEffect(() => {
        set$(ctx, "extraData", extraData);
    }, [extraData]);

    useLayoutEffect(() => {
        if (IsNewArchitecture) {
            let measured: LayoutRectangle;
            (refScroller.current as HTMLDivElement & WebViewMethods)?.measure?.(
                (x: number, y: number, width: number, height: number) => {
                    measured = { height, width, x, y };
                },
            );
            if (measured!) {
                const size = Math.floor(measured[horizontal ? "width" : "height"] * 8) / 8;

                if (size) {
                    handleLayout(ctx, state, measured, setCanRender);
                }
            }
        }
    }, []);

    useLayoutEffect(initializeStateVars, [
        memoizedLastItemKeys.join(","),
        numColumnsProp,
        stylePaddingTopState,
        stylePaddingBottomState,
    ]);

    const doInitialAllocateContainersCallback = () => {
        return doInitialAllocateContainers(ctx, state);
    };

    if (!IsNewArchitecture) {
        // Needs to use the initial estimated size on old arch, new arch will come within the useLayoutEffect
        useInit(() => {
            doInitialAllocateContainersCallback();
        });
    }

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        const layout = event.nativeEvent.layout;
        handleLayout(ctx, state, layout, setCanRender);

        if (onLayoutProp) {
            onLayoutProp(event as any);
        }
    }, []);

    useImperativeHandle(forwardedRef, () => {
        const scrollIndexIntoView = (options: Parameters<LegendListRef["scrollIndexIntoView"]>[0]) => {
            const state = refState.current;
            if (state) {
                const { index, ...rest } = options;
                const { startNoBuffer, endNoBuffer } = state;
                if (index < startNoBuffer || index > endNoBuffer) {
                    const viewPosition = index < startNoBuffer ? 0 : 1;
                    scrollToIndex(ctx, state, {
                        ...rest,
                        index,
                        viewPosition,
                    });
                }
            }
        };
        return {
            flashScrollIndicators: () => (refScroller.current as any)?.flashScrollIndicators?.(),
            getNativeScrollRef: () => refScroller.current as any,
            getScrollableNode: () => refScroller.current as any,
            getScrollResponder: () => refScroller.current as any,
            getState: () => {
                const state = refState.current;
                return state
                    ? {
                          contentLength: state.totalSize,
                          data: state.props.data,
                          end: state.endNoBuffer,
                          endBuffered: state.endBuffered,
                          isAtEnd: state.isAtEnd,
                          isAtStart: state.isAtStart,
                          positionAtIndex: (index: number) => state.positions.get(getId(state, index))!,
                          positions: state.positions,
                          scroll: state.scroll,
                          scrollLength: state.scrollLength,
                          sizeAtIndex: (index: number) => state.sizesKnown.get(getId(state, index))!,
                          sizes: state.sizesKnown,
                          start: state.startNoBuffer,
                          startBuffered: state.startBuffered,
                      }
                    : ({} as ScrollState);
            },
            scrollIndexIntoView,
            scrollItemIntoView: ({ item, ...props }) => {
                const data = refState.current!.props.data;
                const index = data.indexOf(item);
                if (index !== -1) {
                    scrollIndexIntoView({ index, ...props });
                }
            },
            scrollToEnd: (options) => {
                const data = refState.current!.props.data;
                const stylePaddingBottom = refState.current!.props.stylePaddingBottom;
                const index = data.length - 1;
                if (index !== -1) {
                    const paddingBottom = stylePaddingBottom || 0;
                    const footerSize = peek$(ctx, "footerSize") || 0;
                    scrollToIndex(ctx, state, {
                        index,
                        viewOffset: -paddingBottom - footerSize + (options?.viewOffset || 0),
                        viewPosition: 1,
                        ...options,
                    });
                }
            },
            scrollToIndex: (params) => scrollToIndex(ctx, state, params),
            scrollToItem: ({ item, ...props }) => {
                const data = refState.current!.props.data;
                const index = data.indexOf(item);
                if (index !== -1) {
                    scrollToIndex(ctx, state, { index, ...props });
                }
            },
            scrollToOffset: (params) => scrollTo(state, params),
            setScrollProcessingEnabled: (enabled: boolean) => {
                refState.current!.scrollProcessingEnabled = enabled;
            },
            setVisibleContentAnchorOffset: (value: number | ((value: number) => number)) => {
                const val = typeof value === "function" ? value(peek$(ctx, "scrollAdjustUserOffset") || 0) : value;
                set$(ctx, "scrollAdjustUserOffset", val);
            },
        };
    }, []);

    if (Platform.OS === "web") {
        useEffect(() => {
            if (initialContentOffset) {
                scrollTo(state, { animated: false, offset: initialContentOffset });
            }
        }, []);
    }

    const fns = useMemo(
        () => ({
            getRenderedItem: (key: string) => getRenderedItem(ctx, state, key),
            onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => onScroll(ctx, state, event as any),
            updateItemSize: (itemKey: string, sizeObj: { width: number; height: number }) =>
                updateItemSize(ctx, state, itemKey, sizeObj),
        }),
        [],
    );

    // Create dual scroll handlers - one for native animations, one for JS logic
    const onScrollHandler = useMemo<typeof fns.onScroll>(() => {
        if (stickyIndices?.length) {
            const { animatedScrollY } = ctx;
            return createAnimatedEvent(
                [{ nativeEvent: { contentOffset: { [horizontal ? "x" : "y"]: animatedScrollY } } }],
                {
                    listener: fns.onScroll,
                    useNativeDriver: true,
                },
            );
        }
        return fns.onScroll;
    }, [stickyIndices?.join(","), horizontal]);

    return (
        <>
            <ListComponent
                {...rest}
                alignItemsAtEnd={alignItemsAtEnd}
                canRender={canRender}
                contentContainerStyle={contentContainerStyle}
                getRenderedItem={fns.getRenderedItem}
                horizontal={horizontal!}
                initialContentOffset={initialContentOffset}
                ListEmptyComponent={dataProp.length === 0 ? ListEmptyComponent : undefined}
                ListHeaderComponent={ListHeaderComponent}
                maintainVisibleContentPosition={maintainVisibleContentPosition}
                onLayout={onLayout}
                onLayoutHeader={onLayoutHeader}
                onMomentumScrollEnd={(event) => {
                    if (IsNewArchitecture) {
                        requestAnimationFrame(() => {
                            finishScrollTo(refState.current);
                        });
                    } else {
                        // TODO: This is a hack to fix an issue where items rendered while scrolling take a while to layout.
                        // This should ideally wait until all layouts have settled.
                        setTimeout(() => {
                            finishScrollTo(refState.current);
                        }, 1000);
                    }

                    if (onMomentumScrollEnd) {
                        onMomentumScrollEnd(event);
                    }
                }}
                onScroll={onScrollHandler}
                recycleItems={recycleItems}
                refreshControl={
                    refreshControl
                        ? stylePaddingTopState > 0
                            ? React.cloneElement(refreshControl, {
                                  progressViewOffset:
                                      (refreshControl.props.progressViewOffset || 0) + stylePaddingTopState,
                              })
                            : refreshControl
                        : onRefresh && (
                              <RefreshControl
                                  onRefresh={onRefresh}
                                  progressViewOffset={(progressViewOffset || 0) + stylePaddingTopState}
                                  refreshing={!!refreshing}
                              />
                          )
                }
                refScrollView={combinedRef}
                scrollAdjustHandler={state.scrollAdjustHandler}
                scrollEventThrottle={Platform.OS === "web" ? 16 : undefined}
                snapToIndices={snapToIndices}
                stickyIndices={stickyIndices}
                style={style}
                updateItemSize={fns.updateItemSize}
                waitForInitialLayout={waitForInitialLayout}
            />
            {__DEV__ && ENABLE_DEBUG_VIEW && <DebugView state={refState.current!} />}
        </>
    );
});
