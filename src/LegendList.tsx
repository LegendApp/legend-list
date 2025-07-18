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
import {
    type Animated,
    Dimensions,
    type LayoutChangeEvent,
    type LayoutRectangle,
    type NativeScrollEvent,
    Platform,
    RefreshControl,
    type ScrollView,
    StyleSheet,
    type View,
} from "react-native";
import { DebugView } from "./DebugView";
import { ListComponent } from "./ListComponent";
import { ScrollAdjustHandler } from "./ScrollAdjustHandler";
import { calculateItemsInView } from "./calculateItemsInView";
import { calculateOffsetForIndex } from "./calculateOffsetForIndex";
import { checkAtBottom } from "./checkAtBottom";
import { checkAtTop } from "./checkAtTop";
import { ENABLE_DEBUG_VIEW, IsNewArchitecture } from "./constants";
import { createColumnWrapperStyle } from "./createColumnWrapperStyle";
import { doInitialAllocateContainers } from "./doInitialAllocateContainers";
import { doMaintainScrollAtEnd } from "./doMaintainScrollAtEnd";
import { finishScrollTo } from "./finishScrollTo";
import { getId } from "./getId";
import { getRenderedItem } from "./getRenderedItem";
import { handleLayout } from "./handleLayout";
import { extractPadding, warnDevOnce } from "./helpers";
import { onScroll } from "./onScroll";
import { requestAdjust } from "./requestAdjust";
import { scrollTo } from "./scrollTo";
import { scrollToIndex } from "./scrollToIndex";
import { setPaddingTop } from "./setPaddingTop";
import { StateProvider, peek$, set$, useStateContext } from "./state";
import type {
    InternalState,
    LegendListProps,
    LegendListRef,
    MaintainScrollAtEndOptions,
    ScrollIndexWithOffsetPosition,
    ScrollState,
} from "./types";
import { typedForwardRef } from "./types";
import { updateAllPositions } from "./updateAllPositions";
import { updateItemSize } from "./updateItemSize";
import { updateSnapToOffsets } from "./updateSnapToOffsets";
import { useAnimatedValue } from "./useAnimatedValue";
import { useCombinedRef } from "./useCombinedRef";
import { useInit } from "./useInit";
import { setupViewability } from "./viewability";

const DEFAULT_DRAW_DISTANCE = 250;
const DEFAULT_ITEM_SIZE = 100;

export const LegendList = typedForwardRef(function LegendList<T>(
    props: LegendListProps<T>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    return (
        <StateProvider>
            <LegendListInner {...props} ref={forwardedRef} />
        </StateProvider>
    );
});

const LegendListInner = typedForwardRef(function LegendListInner<T>(
    props: LegendListProps<T>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const {
        data: dataProp = [],
        initialScrollIndex: initialScrollIndexProp,
        initialScrollOffset,
        horizontal,
        drawDistance = 250,
        recycleItems = false,
        onEndReachedThreshold = 0.5,
        onStartReachedThreshold = 0.5,
        maintainScrollAtEnd = false,
        maintainScrollAtEndThreshold = 0.1,
        alignItemsAtEnd = false,
        maintainVisibleContentPosition = false,
        onScroll: onScrollProp,
        onMomentumScrollEnd,
        numColumns: numColumnsProp = 1,
        columnWrapperStyle,
        keyExtractor: keyExtractorProp,
        renderItem,
        estimatedListSize,
        estimatedItemSize: estimatedItemSizeProp,
        getEstimatedItemSize,
        suggestEstimatedItemSize,
        ListHeaderComponent,
        ListEmptyComponent,
        onItemSizeChanged,
        refScrollView,
        waitForInitialLayout = true,
        extraData,
        contentContainerStyle: contentContainerStyleProp,
        style: styleProp,
        onLayout: onLayoutProp,
        onRefresh,
        refreshing,
        progressViewOffset,
        refreshControl,
        initialContainerPoolRatio = 2,
        viewabilityConfig,
        viewabilityConfigCallbackPairs,
        snapToIndices,
        onViewableItemsChanged,
        onStartReached,
        onEndReached,
        onLoad,
        ...rest
    } = props;

    const [renderNum, setRenderNum] = useState(0);
    const initialScroll: ScrollIndexWithOffsetPosition | undefined =
        typeof initialScrollIndexProp === "number" ? { index: initialScrollIndexProp } : initialScrollIndexProp;
    const initialScrollIndex = initialScroll?.index;
    const animatedScrollAdjustUserOffset = useAnimatedValue(0);

    const [canRender, setCanRender] = React.useState(!IsNewArchitecture);

    const contentContainerStyle = { ...StyleSheet.flatten(contentContainerStyleProp) };
    const style = { ...StyleSheet.flatten(styleProp) };
    const stylePaddingTopState = extractPadding(style, contentContainerStyle, "Top");
    const stylePaddingBottomState = extractPadding(style, contentContainerStyle, "Bottom");

    const ctx = useStateContext();
    ctx.columnWrapperStyle =
        columnWrapperStyle || (contentContainerStyle ? createColumnWrapperStyle(contentContainerStyle) : undefined);

    const refScroller = useRef<ScrollView>(null) as React.MutableRefObject<ScrollView>;
    const combinedRef = useCombinedRef(refScroller, refScrollView);
    const estimatedItemSize = estimatedItemSizeProp ?? DEFAULT_ITEM_SIZE;
    const scrollBuffer = (drawDistance ?? DEFAULT_DRAW_DISTANCE) || 1;
    const keyExtractor = keyExtractorProp ?? ((item, index) => index.toString());

    const refState = useRef<InternalState>();

    if (!refState.current) {
        const initialScrollLength = (estimatedListSize ??
            (IsNewArchitecture ? { width: 0, height: 0 } : Dimensions.get("window")))[horizontal ? "width" : "height"];

        refState.current = {
            sizes: new Map(),
            positions: new Map(),
            columns: new Map(),
            pendingAdjust: 0,
            isStartReached: false,
            isEndReached: false,
            isAtEnd: false,
            isAtStart: false,
            scrollLength: initialScrollLength,
            startBuffered: -1,
            startNoBuffer: -1,
            endBuffered: -1,
            endNoBuffer: -1,
            firstFullyOnScreenIndex: -1,
            scroll: 0,
            totalSize: 0,
            timeouts: new Set(),
            viewabilityConfigCallbackPairs: undefined as never,
            scrollAdjustHandler: new ScrollAdjustHandler(ctx),
            nativeMarginTop: 0,
            scrollPrev: 0,
            scrollPrevTime: 0,
            scrollTime: 0,
            scrollPending: 0,
            indexByKey: new Map(),
            scrollHistory: [],
            sizesKnown: new Map(),
            timeoutSizeMessage: 0,
            startReachedBlockedByTimer: false,
            endReachedBlockedByTimer: false,
            scrollForNextCalculateItemsInView: undefined,
            enableScrollForNextCalculateItemsInView: true,
            minIndexSizeChanged: 0,
            queuedCalculateItemsInView: 0,
            lastBatchingAction: Date.now(),
            averageSizes: {},
            idsInView: [],
            containerItemKeys: new Set(),
            idCache: new Map(),
            props: {} as any,
            refScroller: undefined as any,
            loadStartTime: Date.now(),
            initialScroll,
            lastLayout: undefined,
        };

        set$(ctx, "animatedScrollAdjustUserOffset", animatedScrollAdjustUserOffset);
        set$(ctx, "maintainVisibleContentPosition", maintainVisibleContentPosition);
        set$(ctx, "extraData", extraData);
    }

    const state = refState.current!;

    console.log("render list");

    const isFirst = !state.props.renderItem;

    const didDataChange = state.props.data !== dataProp;
    state.props = {
        alignItemsAtEnd,
        data: dataProp,
        estimatedItemSize,
        maintainScrollAtEnd,
        maintainScrollAtEndThreshold,
        onEndReachedThreshold,
        onStartReachedThreshold,
        stylePaddingBottom: stylePaddingBottomState,
        horizontal: !!horizontal,
        maintainVisibleContentPosition,
        onItemSizeChanged,
        suggestEstimatedItemSize: !!suggestEstimatedItemSize,
        keyExtractor,
        onScroll: onScrollProp,
        getEstimatedItemSize,
        onStartReached,
        onEndReached,
        onLoad,
        renderItem: renderItem!,
        initialScroll,
        scrollBuffer,
        viewabilityConfigCallbackPairs: undefined,
        numColumns: numColumnsProp,
        initialContainerPoolRatio,
        stylePaddingTop: stylePaddingTopState,
        snapToIndices,
    };

    state.refScroller = refScroller;

    const checkResetContainers = (isFirst: boolean) => {
        const state = refState.current;
        if (state) {
            state.props.data = dataProp;

            if (!isFirst) {
                calculateItemsInView(ctx, state, { dataChanged: true, doMVCP: true });

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
    const initalizeStateVars = () => {
        set$(ctx, "lastItemKeys", memoizedLastItemKeys);
        set$(ctx, "numColumns", numColumnsProp);

        // If the stylePaddingTop has changed, scroll to an adjusted offset to
        // keep the same content in view
        const prevPaddingTop = peek$(ctx, "stylePaddingTop");
        setPaddingTop(ctx, { stylePaddingTop: stylePaddingTopState });
        refState.current!.props.stylePaddingBottom = stylePaddingBottomState;

        const paddingDiff = stylePaddingTopState - prevPaddingTop;
        // If the style padding has changed then adjust the paddingTop and update scroll to compensate
        // Only iOS seems to need the scroll compensation
        if (paddingDiff && prevPaddingTop !== undefined && Platform.OS === "ios") {
            calculateItemsInView(ctx, state, { doMVCP: true });
            requestAdjust(ctx, state, paddingDiff);
        }
    };
    if (isFirst) {
        initalizeStateVars();
        updateAllPositions(ctx, state);
    }
    const initialContentOffset = useMemo(() => {
        const initialContentOffset = initialScrollOffset || calculateOffsetForIndex(ctx, state, initialScrollIndex);
        refState.current!.isStartReached =
            initialContentOffset < refState.current!.scrollLength * onStartReachedThreshold!;

        if (initialContentOffset > 0) {
            scrollTo(state, { offset: initialContentOffset, animated: false, index: initialScrollIndex });
        }

        return initialContentOffset;
    }, [renderNum]);

    if (isFirst || didDataChange || numColumnsProp !== peek$(ctx, "numColumns")) {
        refState.current.lastBatchingAction = Date.now();
        if (!keyExtractorProp && !isFirst && didDataChange) {
            __DEV__ &&
                warnDevOnce(
                    "keyExtractor",
                    "Changing data without a keyExtractor can cause slow performance and resetting scroll. If your list data can change you should use a keyExtractor with a unique id for best performance and behavior.",
                );
            // If we have no keyExtractor then we have no guarantees about previous item sizes so we have to reset
            refState.current.sizes.clear();
            refState.current.positions.clear();
        }
    }

    useLayoutEffect(() => {
        if (IsNewArchitecture) {
            let measured: LayoutRectangle;
            (refScroller.current as unknown as View).measure((x, y, width, height) => {
                measured = { x, y, width, height };
            });
            if (measured!) {
                const size = Math.floor(measured[horizontal ? "width" : "height"] * 8) / 8;

                if (size) {
                    handleLayout(ctx, state, measured, setCanRender);
                }
            }
        }
        if (!isFirst) {
            calculateItemsInView(ctx, state, { doMVCP: true });
        }
    }, [dataProp]);

    const onLayoutHeader = useCallback((rect: LayoutRectangle, fromLayoutEffect: boolean) => {
        const size = rect[horizontal ? "width" : "height"];
        set$(ctx, "headerSize", size);

        if (initialScroll) {
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

    useLayoutEffect(initalizeStateVars, [
        memoizedLastItemKeys.join(","),
        numColumnsProp,
        stylePaddingTopState,
        stylePaddingBottomState,
    ]);

    const doInitialAllocateContainersCallback = () => {
        return doInitialAllocateContainers(ctx, state);
    };

    useEffect(() => {
        const viewability = setupViewability({
            viewabilityConfig,
            viewabilityConfigCallbackPairs,
            onViewableItemsChanged,
        });
        state.viewabilityConfigCallbackPairs = viewability;
        state.props.viewabilityConfigCallbackPairs = viewability;
        state.enableScrollForNextCalculateItemsInView = !viewability;
    }, [viewabilityConfig, viewabilityConfigCallbackPairs, onViewableItemsChanged]);

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
            onLayoutProp(event);
        }
    }, []);

    useImperativeHandle(
        forwardedRef,
        () => {
            const scrollIndexIntoView = (options: Parameters<LegendListRef["scrollIndexIntoView"]>[0]) => {
                const state = refState.current;
                if (state) {
                    const { index, ...rest } = options;
                    const { startNoBuffer, endNoBuffer } = state;
                    if (index < startNoBuffer || index > endNoBuffer) {
                        const viewPosition = index < startNoBuffer ? 0 : 1;
                        scrollToIndex(ctx, state, {
                            ...rest,
                            viewPosition,
                            index,
                        });
                    }
                }
            };
            return {
                flashScrollIndicators: () => refScroller.current!.flashScrollIndicators(),
                getNativeScrollRef: () => refScroller.current!,
                getScrollableNode: () => refScroller.current!.getScrollableNode(),
                getScrollResponder: () => refScroller.current!.getScrollResponder(),
                getState: () => {
                    const state = refState.current;
                    return state
                        ? {
                              contentLength: state.totalSize,
                              end: state.endNoBuffer,
                              endBuffered: state.endBuffered,
                              isAtEnd: state.isAtEnd,
                              isAtStart: state.isAtStart,
                              scroll: state.scroll,
                              scrollLength: state.scrollLength,
                              start: state.startNoBuffer,
                              startBuffered: state.startBuffered,
                              sizes: state.sizesKnown,
                              sizeAtIndex: (index: number) => state.sizesKnown.get(getId(state, index))!,
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
                scrollToIndex: (params) => scrollToIndex(ctx, state, params),
                scrollToItem: ({ item, ...props }) => {
                    const data = refState.current!.props.data;
                    const index = data.indexOf(item);
                    if (index !== -1) {
                        scrollToIndex(ctx, state, { index, ...props });
                    }
                },
                scrollToOffset: (params) => scrollTo(state, params),
                scrollToEnd: (options) => {
                    const data = refState.current!.props.data;
                    const stylePaddingBottom = refState.current!.props.stylePaddingBottom;
                    const index = data.length - 1;
                    if (index !== -1) {
                        const paddingBottom = stylePaddingBottom || 0;
                        const footerSize = peek$(ctx, "footerSize") || 0;
                        scrollToIndex(ctx, state, {
                            index,
                            viewPosition: 1,
                            viewOffset: -paddingBottom - footerSize,
                            ...options,
                        });
                    }
                },
                setVisibleContentAnchorOffset: (value: number | ((value: number) => number)) => {
                    const val = typeof value === "function" ? value(peek$(ctx, "scrollAdjustUserOffset") || 0) : value;
                    set$(ctx, "scrollAdjustUserOffset", val);
                },
                animateVisibleContentAnchorOffset: (fn: (value: Animated.Value) => void) => {
                    fn(animatedScrollAdjustUserOffset);
                },
            };
        },
        [],
    );

    if (Platform.OS === "web") {
        useEffect(() => {
            if (initialContentOffset) {
                scrollTo(state, { offset: initialContentOffset, animated: false });
            }
        }, []);
    }

    const fns = useMemo(
        () => ({
            updateItemSize: (itemKey: string, sizeObj: { width: number; height: number }) =>
                updateItemSize(ctx, state, itemKey, sizeObj),
            getRenderedItem: (key: string) => getRenderedItem(ctx, state, key),
            onScroll: (event: { nativeEvent: NativeScrollEvent }) => onScroll(ctx, state, event),
        }),
        [],
    );

    return (
        <>
            <ListComponent
                {...rest}
                canRender={canRender}
                horizontal={horizontal!}
                refScrollView={combinedRef}
                initialContentOffset={initialContentOffset}
                getRenderedItem={fns.getRenderedItem}
                updateItemSize={fns.updateItemSize}
                onScroll={fns.onScroll}
                onMomentumScrollEnd={(event) => {
                    requestAnimationFrame(() => {
                        finishScrollTo(refState.current);
                    });

                    if (onMomentumScrollEnd) {
                        onMomentumScrollEnd(event);
                    }
                }}
                onLayout={onLayout}
                recycleItems={recycleItems}
                alignItemsAtEnd={alignItemsAtEnd}
                ListEmptyComponent={dataProp.length === 0 ? ListEmptyComponent : undefined}
                ListHeaderComponent={ListHeaderComponent}
                maintainVisibleContentPosition={maintainVisibleContentPosition}
                scrollEventThrottle={Platform.OS === "web" ? 16 : undefined}
                waitForInitialLayout={waitForInitialLayout}
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
                                  refreshing={!!refreshing}
                                  onRefresh={onRefresh}
                                  progressViewOffset={(progressViewOffset || 0) + stylePaddingTopState}
                              />
                          )
                }
                style={style}
                contentContainerStyle={contentContainerStyle}
                scrollAdjustHandler={refState.current?.scrollAdjustHandler}
                onLayoutHeader={onLayoutHeader}
                snapToIndices={snapToIndices}
            />
            {__DEV__ && ENABLE_DEBUG_VIEW && <DebugView state={refState.current!} />}
        </>
    );
});
