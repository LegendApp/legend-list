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
    Dimensions,
    type LayoutChangeEvent,
    type LayoutRectangle,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    Platform,
    RefreshControl,
    type ScrollView,
    StyleSheet,
    type ViewStyle,
} from "react-native";
import { DebugView } from "./DebugView";
import { ListComponent } from "./ListComponent";
import { ScrollAdjustHandler } from "./ScrollAdjustHandler";
import { ENABLE_DEBUG_VIEW, IsNewArchitecture, POSITION_OUT_OF_VIEW } from "./constants";
import { comparatorByDistance, comparatorDefault, extractPadding, warnDevOnce } from "./helpers";
import { StateProvider, getContentSize, peek$, set$, useStateContext } from "./state";
import type {
    ColumnWrapperStyle,
    InternalState,
    LegendListProps,
    LegendListRef,
    ScrollIndexWithOffsetPosition,
    ScrollState,
} from "./types";
import { typedForwardRef } from "./types";
import { useCombinedRef } from "./useCombinedRef";
import { useInit } from "./useInit";
import { setupViewability, updateViewableItems } from "./viewability";

const DEFAULT_DRAW_DISTANCE = 250;
const DEFAULT_ITEM_SIZE = 100;

function createColumnWrapperStyle(contentContainerStyle: ViewStyle): ColumnWrapperStyle | undefined {
    const { gap, columnGap, rowGap } = contentContainerStyle;
    if (gap || columnGap || rowGap) {
        contentContainerStyle.gap = undefined;
        contentContainerStyle.columnGap = undefined;
        contentContainerStyle.rowGap = undefined;
        return {
            gap: gap as number,
            columnGap: columnGap as number,
            rowGap: rowGap as number,
        };
    }
}

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
        onViewableItemsChanged,
        ...rest
    } = props;

    const [renderNum, setRenderNum] = useState(0);
    const initialScroll: ScrollIndexWithOffsetPosition | undefined =
        typeof initialScrollIndexProp === "number" ? { index: initialScrollIndexProp } : initialScrollIndexProp;
    const initialScrollIndex = initialScroll?.index;

    const refLoadStartTime = useRef<number>(Date.now());
    const [canRender, setCanRender] = React.useState(!IsNewArchitecture);

    const callbacks = useRef({
        onStartReached: rest.onStartReached,
        onEndReached: rest.onEndReached,
    });

    // ensure that the callbacks are updated
    callbacks.current.onStartReached = rest.onStartReached;
    callbacks.current.onEndReached = rest.onEndReached;

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
    const getId = (index: number): string => {
        const state = refState.current;
        if (!state?.data) {
            return "";
        }

        // Check cache first
        const cached = state.idCache.get(index);
        if (cached !== undefined) {
            return cached;
        }

        // Generate and cache the ID
        const data = state.data;
        const ret = index < data.length ? (keyExtractor ? keyExtractor(data[index], index) : index) : null;
        const id = ret as string;
        state.idCache.set(index, id);
        return id;
    };

    const getItemSize = (key: string, index: number, data: T, useAverageSize = false) => {
        const state = refState.current!;
        const sizeKnown = state.sizesKnown.get(key)!;
        if (sizeKnown !== undefined) {
            return sizeKnown;
        }
        const sizePrevious = state.sizes.get(key)!;

        if (sizePrevious !== undefined) {
            return sizePrevious;
        }

        // TODO: Using averages was causing many problems, so we're disabling it for now
        // Specifically, it was causing the scrollToIndex to not work correctly
        // and didn't work well when prepending items to the list
        // Get average size of rendered items if we don't know the size or are using getEstimatedItemSize
        // TODO: Columns throws off the size, come back and fix that by using getRowHeight
        // if (sizeKnown === undefined && !getEstimatedItemSize && numColumns === 1 && useAverageSize) {
        //     // TODO: Hook this up to actual item type later once we have item types
        //     const itemType = "";
        //     const average = state.averageSizes[itemType];
        //     if (average) {
        //         size = roundSize(average.avg);
        //         if (size !== sizePrevious) {
        //             addTotalSize(key, size - sizePrevious, 0);
        //         }
        //     }
        // }

        // Get estimated size if we don't have an average or already cached size
        const size = getEstimatedItemSize ? getEstimatedItemSize(index, data) : estimatedItemSize;

        // Save to rendered sizes
        state.sizes.set(key, size);
        return size;
    };
    const calculateOffsetForIndex = (index: number | undefined) => {
        let position = 0;

        if (index !== undefined) {
            position = refState.current?.positions.get(getId(index!)) || 0;
        }

        const paddingTop = peek$(ctx, "stylePaddingTop");
        if (paddingTop) {
            position += paddingTop;
        }

        const headerSize = peek$(ctx, "headerSize");
        if (headerSize) {
            position += headerSize;
        }

        return position;
    };
    const calculateOffsetWithOffsetPosition = (offsetParam: number, params: Partial<ScrollIndexWithOffsetPosition>) => {
        const { index, viewOffset, viewPosition } = params;
        let offset = offsetParam;
        const state = refState.current!;
        if (viewOffset) {
            offset -= viewOffset;
        }

        if (viewPosition !== undefined && index !== undefined) {
            // TODO: This can be inaccurate if the item size is very different from the estimatedItemSize
            // In the future we can improve this by listening for the item size change and then updating the scroll position
            offset -= viewPosition * (state.scrollLength - getItemSize(getId(index), index, state.data[index]));
        }

        return offset;
    };

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
            data: dataProp,
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
            renderItem: undefined as never,
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
            onScroll: onScrollProp,
            idsInView: [],
            containerItemKeys: new Set(),
            idCache: new Map(),
        };

        set$(ctx, "maintainVisibleContentPosition", maintainVisibleContentPosition);
        set$(ctx, "extraData", extraData);
    }

    const didDataChange = refState.current.data !== dataProp;
    refState.current.data = dataProp;
    refState.current.onScroll = onScrollProp;

    const getScrollVelocity = () => {
        const state = refState.current!;
        let velocity = 0;
        if (state.scrollHistory.length >= 2) {
            const newest = state.scrollHistory[state.scrollHistory.length - 1];
            let oldest: (typeof state.scrollHistory)[0] | undefined;

            // Find oldest entry within 60ms of newest
            for (let i = 0; i < state.scrollHistory.length - 1; i++) {
                const entry = state.scrollHistory[i];
                if (newest.time - entry.time <= 100) {
                    oldest = entry;
                    break;
                }
            }

            if (oldest) {
                const scrollDiff = newest.scroll - oldest.scroll;
                const timeDiff = newest.time - oldest.time;
                velocity = timeDiff > 0 ? scrollDiff / timeDiff : 0;
            }
        }

        return velocity;
    };

    const updateAllPositions = (dataChanged?: boolean | undefined, startIndexParam?: number | undefined) => {
        const { columns, data, indexByKey, positions, firstFullyOnScreenIndex, idCache, sizes } = refState.current!;
        const numColumns = peek$(ctx, "numColumns") ?? numColumnsProp;
        const indexByKeyForChecking = __DEV__ ? new Map() : undefined;
        const scrollVelocity = getScrollVelocity();

        if (dataChanged) {
            indexByKey.clear();
            idCache.clear();
        }

        const startIndex = startIndexParam ?? 0;

        // Check if we should use backwards optimization when scrolling up
        const shouldUseBackwards =
            !dataChanged && scrollVelocity < 0 && firstFullyOnScreenIndex > 5 && firstFullyOnScreenIndex < data!.length;

        if (shouldUseBackwards && firstFullyOnScreenIndex !== undefined) {
            // Get the current position of firstFullyOnScreenIndex as anchor
            const anchorId = getId(firstFullyOnScreenIndex)!;
            const anchorPosition = positions.get(anchorId);

            // If we don't have the anchor position, fall back to regular behavior
            if (anchorPosition !== undefined) {
                // Start from the anchor and go backwards
                let currentRowTop = anchorPosition;
                let maxSizeInRow = 0;
                let bailout = false;

                // Process items backwards from firstFullyOnScreenIndex - 1 to 0
                for (let i = firstFullyOnScreenIndex - 1; i >= startIndex; i--) {
                    const id = getId(i)!;
                    const size = getItemSize(id, i, data[i], false);
                    const itemColumn = columns.get(id)!;

                    maxSizeInRow = Math.max(maxSizeInRow, size);

                    // When we reach column 1, we're at the start of a new row going backwards
                    if (itemColumn === 1) {
                        currentRowTop -= maxSizeInRow;
                        maxSizeInRow = 0;
                    }

                    // Check if position goes too low - bail if so
                    if (currentRowTop < -2000) {
                        bailout = true;
                        break;
                    }

                    // Update position for this item (columns and indexByKey already set)
                    positions.set(id, currentRowTop);
                }

                if (!bailout) {
                    // We successfully processed backwards, we're done
                    updateTotalSize();
                    return;
                }
            }
        }

        // Regular ascending behavior (either not scrolling up or bailed out)
        let currentRowTop = 0;
        let column = 1;
        let maxSizeInRow = 0;

        const hasColumns = numColumns > 1;
        const needsIndexByKey = dataChanged || indexByKey.size === 0;

        if (startIndex > 0) {
            const startId = idCache.get(startIndex)!;
            if (startId !== undefined) {
                column = columns.get(startId)!;
                currentRowTop = positions.get(startId)!;
            }
        }

        // Note that this loop is micro-optimized because it's a hot path
        const dataLength = data!.length;
        for (let i = startIndex; i < dataLength; i++) {
            // Inline the map get calls to avoid the overhead of the function call
            const id = idCache.get(i) ?? getId(i)!;
            const size = sizes.get(id) ?? getItemSize(id, i, data[i], false);

            // Set index mapping for this item
            if (__DEV__ && needsIndexByKey) {
                if (indexByKeyForChecking!.has(id)) {
                    console.error(
                        `[legend-list] Error: Detected overlapping key (${id}) which causes missing items and gaps and other terrrible things. Check that keyExtractor returns unique values.`,
                    );
                }
                indexByKeyForChecking!.set(id, i);
            }

            // Set position for this item
            positions.set(id, currentRowTop);

            // Update indexByKey if needed
            if (needsIndexByKey) {
                indexByKey.set(id, i);
            }

            if (hasColumns) {
                if (size > maxSizeInRow) {
                    maxSizeInRow = size;
                }

                // Set column for this item
                columns.set(id, column);

                column++;
                if (column > numColumns) {
                    // Move to next row
                    currentRowTop += maxSizeInRow;
                    column = 1;
                    maxSizeInRow = 0;
                }
            } else {
                currentRowTop += size;
            }
        }

        updateTotalSize();
    };

    const scrollToIndex = ({
        index,
        viewOffset = 0,
        animated = true,
        viewPosition,
    }: Parameters<LegendListRef["scrollToIndex"]>[0]) => {
        const state = refState.current!;
        if (index >= state.data.length) {
            index = state.data.length - 1;
        } else if (index < 0) {
            index = 0;
        }

        const firstIndexOffset = calculateOffsetForIndex(index);

        const isLast = index === state.data.length - 1;
        if (isLast && viewPosition === undefined) {
            viewPosition = 1;
        }
        const firstIndexScrollPostion = firstIndexOffset - viewOffset;

        state.scrollForNextCalculateItemsInView = undefined;

        scrollTo({ offset: firstIndexScrollPostion, animated, index, viewPosition: viewPosition ?? 0, viewOffset });
    };

    const setDidLayout = () => {
        refState.current!.queuedInitialLayout = true;
        checkAtBottom();

        set$(ctx, "containersDidLayout", true);

        if (props.onLoad) {
            props.onLoad({ elapsedTimeInMs: Date.now() - refLoadStartTime.current });
        }
    };

    const addTotalSize = useCallback((key: string | null, add: number) => {
        const state = refState.current!;
        if (key === null) {
            state.totalSize = add;
        } else {
            state.totalSize += add;
        }

        set$(ctx, "totalSize", state.totalSize);

        if (alignItemsAtEnd) {
            updateAlignItemsPaddingTop();
        }
    }, []);

    const checkAllSizesKnown = useCallback(() => {
        const { startBuffered, endBuffered, sizesKnown } = refState.current!;
        if (endBuffered !== null) {
            // If waiting for initial layout and all items in view have a known size then
            // initial layout is complete
            let areAllKnown = true;
            for (let i = startBuffered!; areAllKnown && i <= endBuffered!; i++) {
                const key = getId(i)!;
                areAllKnown &&= sizesKnown.has(key);
            }
            return areAllKnown;
        }
        return false;
    }, []);

    const requestAdjust = (positionDiff: number) => {
        if (Math.abs(positionDiff) > 0.1) {
            const state = refState.current!;
            const doit = () => {
                state.scrollAdjustHandler.requestAdjust(positionDiff);
            };
            state.scroll += positionDiff;
            state.scrollForNextCalculateItemsInView = undefined;

            if (peek$(ctx, "containersDidLayout")) {
                doit();
            } else {
                requestAnimationFrame(doit);
            }

            // Calculate a threshold to ignore scroll jumps for a short period of time
            // This is to avoid the case where a scroll event comes in that was relevant from before
            // the requestAdjust. So we ignore scroll events that are closer to the previous
            // scroll position than the target position.
            const threshold = state.scroll - positionDiff / 2;
            if (!state.ignoreScrollFromMVCP) {
                state.ignoreScrollFromMVCP = {};
            }
            if (positionDiff > 0) {
                state.ignoreScrollFromMVCP.lt = threshold;
            } else {
                state.ignoreScrollFromMVCP.gt = threshold;
            }

            if (state.ignoreScrollFromMVCPTimeout) {
                clearTimeout(state.ignoreScrollFromMVCPTimeout);
            }
            state.ignoreScrollFromMVCPTimeout = setTimeout(() => {
                state.ignoreScrollFromMVCP = undefined;
            }, 100);
        }
    };

    const prepareMVCP = useCallback((): (() => void) => {
        const state = refState.current!;
        const { positions, scrollingTo } = state;

        let prevPosition: number;
        let targetId: string | undefined;
        let targetIndex: number | undefined;
        const scrollTarget = scrollingTo?.index;

        if (maintainVisibleContentPosition) {
            const indexByKey = state.indexByKey;

            if (scrollTarget !== undefined) {
                // If we're currently scrolling to a target index, do MVCP for its position
                targetId = getId(scrollTarget);
                targetIndex = scrollTarget;
            } else if (state.idsInView.length > 0 && peek$(ctx, "containersDidLayout")) {
                // Do MVCP for the first item fully in view
                targetId = state.idsInView.find((id) => indexByKey.get(id) !== undefined);
                targetIndex = indexByKey.get(targetId!);
            }

            if (targetId !== undefined && targetIndex !== undefined) {
                prevPosition = positions.get(targetId)!;
            }
        }

        // Return a function to do MVCP based on the prepared values
        return () => {
            if (targetId !== undefined && prevPosition !== undefined) {
                const newPosition = positions.get(targetId);

                if (newPosition !== undefined) {
                    const positionDiff = newPosition - prevPosition;

                    if (Math.abs(positionDiff) > 0.1) {
                        requestAdjust(positionDiff);
                    }
                }
            }
        };
    }, []);

    const calculateItemsInView = useCallback(
        (params: { doMVCP?: boolean; dataChanged?: boolean; startIndex?: number } = {}) => {
            const state = refState.current!;
            const {
                data,
                scrollLength,
                startBufferedId: startBufferedIdOrig,
                positions,
                columns,
                containerItemKeys,
                idCache,
                sizes,
                indexByKey,
                scrollForNextCalculateItemsInView,
                enableScrollForNextCalculateItemsInView,
                minIndexSizeChanged,
            } = state!;
            if (!data || scrollLength === 0) {
                return;
            }

            let { queuedInitialLayout, scroll: scrollState } = state!;

            const totalSize = peek$(ctx, "totalSize");
            const topPad = peek$(ctx, "stylePaddingTop") + peek$(ctx, "headerSize");
            const numColumns = peek$(ctx, "numColumns");
            const previousScrollAdjust = 0;
            const { dataChanged, doMVCP, startIndex } = params;
            const speed = getScrollVelocity();

            if (doMVCP || dataChanged) {
                // TODO: This should only run if a size changed or items changed
                // Handle maintainVisibleContentPosition adjustment early
                const checkMVCP = doMVCP ? prepareMVCP() : undefined;

                // Update all positions upfront so we can assume they're correct
                updateAllPositions(dataChanged, startIndex);

                checkMVCP?.();
            }

            const scrollExtra = 0;
            // Disabled this optimization for now because it was causing blanks to appear sometimes
            // We may need to control speed calculation better, or not have a 5 item history to avoid this issue
            // const scrollExtra = Math.max(-16, Math.min(16, speed)) * 24;

            // Don't use averages when disabling scroll jumps because adding items to the top of the list
            // causes jumpiness if using averages
            // TODO Figure out why using average caused jumpiness, maybe we can fix it a better way
            const useAverageSize = false; // speed >= 0 && peek$(ctx, "containersDidLayout");

            // If this is before the initial layout, and we have an initialScrollIndex,
            // then ignore the actual scroll which might be shifting due to scrollAdjustHandler
            // and use the calculated offset of the initialScrollIndex instead.
            if (!queuedInitialLayout && initialScroll) {
                const updatedOffset = calculateOffsetWithOffsetPosition(
                    calculateOffsetForIndex(initialScroll.index),
                    initialScroll,
                );
                scrollState = updatedOffset;
            }

            const scrollAdjustPad = -previousScrollAdjust - topPad;
            let scroll = scrollState + scrollExtra + scrollAdjustPad;

            // Sometimes we may have scrolled past the visible area which can make items at the top of the
            // screen not render. So make sure we clamp scroll to the end.
            if (scroll + scrollLength > totalSize) {
                scroll = totalSize - scrollLength;
            }

            if (ENABLE_DEBUG_VIEW) {
                set$(ctx, "debugRawScroll", scrollState);
                set$(ctx, "debugComputedScroll", scroll);
            }

            let scrollBufferTop = scrollBuffer;
            let scrollBufferBottom = scrollBuffer;

                if (speed > 0) {
                scrollBufferTop = scrollBuffer * 0.2;
                scrollBufferBottom = scrollBuffer * 1.8;
                } else {
                scrollBufferTop = scrollBuffer * 1.8;
                scrollBufferBottom = scrollBuffer * 0.2;
            }

            const scrollTopBuffered = scroll - scrollBufferTop;
            const scrollBottom = scroll + scrollLength;
            const scrollBottomBuffered = scrollBottom + scrollBufferBottom;

            // Check precomputed scroll range to see if we can skip this check
            if (scrollForNextCalculateItemsInView) {
                const { top, bottom } = scrollForNextCalculateItemsInView;
                if (scrollTopBuffered > top && scrollBottomBuffered < bottom) {
                    return;
                }
            }

            let startNoBuffer: number | null = null;
            let startBuffered: number | null = null;
            let startBufferedId: string | null = null;
            let endNoBuffer: number | null = null;
            let endBuffered: number | null = null;

            let loopStart: number = startBufferedIdOrig ? indexByKey.get(startBufferedIdOrig) || 0 : 0;

            if (minIndexSizeChanged !== undefined) {
                loopStart = Math.min(minIndexSizeChanged, loopStart);
                state.minIndexSizeChanged = undefined;
            }

            // Go backwards from the last start position to find the first item that is in view
            // This is an optimization to avoid looping through all items, which could slow down
            // when scrolling at the end of a long list.
            for (let i = loopStart; i >= 0; i--) {
                const id = idCache.get(i) ?? getId(i)!;
                const top = positions.get(id)!;
                const size = sizes.get(id) ?? getItemSize(id, i, data[i], useAverageSize);
                const bottom = top + size;

                if (bottom > scroll - scrollBuffer) {
                    loopStart = i;
                } else {
                    break;
                }
            }

            const loopStartMod = loopStart % numColumns;
            if (loopStartMod > 0) {
                loopStart -= loopStartMod;
            }

            let foundEnd = false;
            let nextTop: number | undefined;
            let nextBottom: number | undefined;

            // TODO PERF: Could cache this while looping through numContainers at the end of this function
            // This takes 0.03 ms in an example in the ios simulator
            const prevNumContainers = ctx.values.get("numContainers") as number;
            let maxIndexRendered = 0;
            for (let i = 0; i < prevNumContainers; i++) {
                const key = peek$(ctx, `containerItemKey${i}`);
                if (key !== undefined) {
                    const index = indexByKey.get(key)!;
                    maxIndexRendered = Math.max(maxIndexRendered, index);
                }
            }

            let firstFullyOnScreenIndex: number | undefined;

            // scan data forwards
            // Continue until we've found the end and we've updated positions of all items that were previously in view
            const dataLength = data!.length;
            for (let i = Math.max(0, loopStart); i < dataLength && (!foundEnd || i <= maxIndexRendered); i++) {
                const id = idCache.get(i) ?? getId(i)!;
                const size = sizes.get(id) ?? getItemSize(id, i, data[i], useAverageSize);
                const top = positions.get(id)!;

                if (!foundEnd) {
                    if (startNoBuffer === null && top + size > scroll) {
                        startNoBuffer = i;
                    }
                    // Subtract 10px for a little buffer so it can be slightly off screen
                    if (firstFullyOnScreenIndex === undefined && top >= scroll - 10) {
                        firstFullyOnScreenIndex = i;
                    }

                    if (startBuffered === null && top + size > scrollTopBuffered) {
                        startBuffered = i;
                        startBufferedId = id;
                        nextTop = top;
                    }
                    if (startNoBuffer !== null) {
                        if (top <= scrollBottom) {
                            endNoBuffer = i;
                        }
                        if (top <= scrollBottomBuffered) {
                            endBuffered = i;
                            nextBottom = top + size;
                        } else {
                            foundEnd = true;
                        }
                    }
                }
            }

            const idsInView: string[] = [];
            for (let i = firstFullyOnScreenIndex!; i <= endNoBuffer!; i++) {
                const id = idCache.get(i) ?? getId(i)!;
                idsInView.push(id);
            }

            Object.assign(state, {
                startBuffered,
                startBufferedId,
                startNoBuffer,
                endBuffered,
                endNoBuffer,
                idsInView,
                firstFullyOnScreenIndex,
            });

            // Precompute the scroll that will be needed for the range to change
            // so it can be skipped if not needed
            if (enableScrollForNextCalculateItemsInView && nextTop !== undefined && nextBottom !== undefined) {
                state.scrollForNextCalculateItemsInView =
                    nextTop !== undefined && nextBottom !== undefined
                        ? {
                              top: nextTop,
                              bottom: nextBottom,
                          }
                        : undefined;
            }

            // console.log(
            //     "start",
            //     Math.round(scroll),
            //     Math.round(scrollState),
            //     Math.round(scrollExtra),
            //     Math.round(scrollAdjustPad),
            //     startBuffered,
            //     startNoBuffer,
            //     endNoBuffer,
            //     endBuffered,
            // );

            const numContainers = peek$(ctx, "numContainers");
            // Reset containers that aren't used anymore because the data has changed
            const pendingRemoval: number[] = [];
            if (dataChanged) {
                for (let i = 0; i < numContainers; i++) {
                    const itemKey = peek$(ctx, `containerItemKey${i}`);
                    if (!keyExtractorProp || (itemKey && indexByKey.get(itemKey) === undefined)) {
                        pendingRemoval.push(i);
                    }
                }
            }

            if (startBuffered !== null && endBuffered !== null) {
                let numContainers = prevNumContainers;
                const needNewContainers: number[] = [];

                for (let i = startBuffered!; i <= endBuffered; i++) {
                    const id = idCache.get(i) ?? getId(i)!;
                    if (!containerItemKeys.has(id)) {
                        needNewContainers.push(i);
                    }
                }

                if (needNewContainers.length > 0) {
                    const availableContainers = findAvailableContainers(
                        needNewContainers.length,
                        startBuffered,
                        endBuffered,
                        pendingRemoval,
                    );
                    for (let idx = 0; idx < needNewContainers.length; idx++) {
                        const i = needNewContainers[idx];
                        const containerIndex = availableContainers[idx];
                        const id = idCache.get(i) ?? getId(i)!;

                        // Remove old key from cache
                        const oldKey = peek$(ctx, `containerItemKey${containerIndex}`);
                        if (oldKey && oldKey !== id) {
                            containerItemKeys!.delete(oldKey);
                        }

                        set$(ctx, `containerItemKey${containerIndex}`, id);
                        set$(ctx, `containerItemData${containerIndex}`, data[i]);

                        // Update cache when adding new item
                        containerItemKeys!.add(id);

                        if (containerIndex >= numContainers) {
                            numContainers = containerIndex + 1;
                        }
                    }

                    if (numContainers !== prevNumContainers) {
                        set$(ctx, "numContainers", numContainers);
                        if (numContainers > peek$(ctx, "numContainersPooled")) {
                            set$(ctx, "numContainersPooled", Math.ceil(numContainers * 1.5));
                        }
                    }
                }

                // Update top positions of all containers
                for (let i = 0; i < numContainers; i++) {
                    const itemKey = peek$(ctx, `containerItemKey${i}`);

                    // If it was
                    if (pendingRemoval.includes(i)) {
                        // Update cache when removing item
                        if (itemKey) {
                            containerItemKeys!.delete(itemKey);
                        }

                        set$(ctx, `containerItemKey${i}`, undefined);
                        set$(ctx, `containerItemData${i}`, undefined);
                        set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                        set$(ctx, `containerColumn${i}`, -1);
                    } else {
                        const itemIndex = indexByKey.get(itemKey)!;
                        const item = data[itemIndex];
                        if (item !== undefined) {
                            const id = idCache.get(itemIndex) ?? getId(itemIndex);
                            const position = positions.get(id);

                            if (position === undefined) {
                                // This item may have been in view before data changed and positions were reset
                                // so we need to set it to out of view
                                set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                            } else {
                                const pos = positions.get(id)!;
                                const column = columns.get(id) || 1;

                                const prevPos = peek$(ctx, `containerPosition${i}`);
                                const prevColumn = peek$(ctx, `containerColumn${i}`);
                                const prevData = peek$(ctx, `containerItemData${i}`);

                                if (!prevPos || (pos > POSITION_OUT_OF_VIEW && pos !== prevPos)) {
                                    set$(ctx, `containerPosition${i}`, pos);
                                }
                                if (column >= 0 && column !== prevColumn) {
                                    set$(ctx, `containerColumn${i}`, column);
                                }

                                if (prevData !== item) {
                                    set$(ctx, `containerItemData${i}`, data[itemIndex]);
                                }
                            }
                        }
                    }
                }
            }

            if (!queuedInitialLayout && endBuffered !== null) {
                // If waiting for initial layout and all items in view have a known size then
                // initial layout is complete
                if (checkAllSizesKnown()) {
                    setDidLayout();
                }
            }

            if (viewabilityConfigCallbackPairs) {
                updateViewableItems(
                    state,
                    ctx,
                    viewabilityConfigCallbackPairs,
                    getId,
                    scrollLength,
                    startNoBuffer!,
                    endNoBuffer!,
                );
            }
        },
        [],
    );

    const setPaddingTop = ({
        stylePaddingTop,
        alignItemsPaddingTop,
    }: { stylePaddingTop?: number; alignItemsPaddingTop?: number }) => {
        if (stylePaddingTop !== undefined) {
            const prevStylePaddingTop = peek$(ctx, "stylePaddingTop") || 0;
            if (stylePaddingTop < prevStylePaddingTop) {
                // If reducing top padding then we need to make sure the ScrollView doesn't
                // scroll itself because the height reduced.
                // First add the padding to the total size so that the total height in the ScrollView
                // doesn't change
                const prevTotalSize = peek$(ctx, "totalSize") || 0;
                set$(ctx, "totalSize", prevTotalSize + prevStylePaddingTop);
                setTimeout(() => {
                    // Then reset it back to how it was
                    set$(ctx, "totalSize", prevTotalSize);
                }, 16);
            }

            // Now set the padding
            set$(ctx, "stylePaddingTop", stylePaddingTop);
        }
        if (alignItemsPaddingTop !== undefined) {
            set$(ctx, "alignItemsPaddingTop", alignItemsPaddingTop);
        }
    };

    const updateAlignItemsPaddingTop = () => {
        if (alignItemsAtEnd) {
            const { data, scrollLength } = refState.current!;
            let alignItemsPaddingTop = 0;
            if (data?.length > 0) {
                const contentSize = getContentSize(ctx);
                alignItemsPaddingTop = Math.max(0, Math.floor(scrollLength - contentSize));
            }
            setPaddingTop({ alignItemsPaddingTop });
        }
    };

    const finishScrollTo = () => {
        const state = refState.current;
        if (state) {
            state.scrollingTo = undefined;
            state.scrollHistory.length = 0;
        }
    };

    const scrollTo = (
        params: {
            animated?: boolean;
            index?: number;
            offset: number;
            viewOffset?: number;
            viewPosition?: number;
        } = {} as any,
    ) => {
        const state = refState.current!;
        const { animated } = params;

        const offset = calculateOffsetWithOffsetPosition(params.offset, params);

        // Disable scroll adjust while scrolling so that it doesn't do extra work affecting the target offset
        state.scrollHistory.length = 0;
        state.scrollingTo = params;
        state.scrollPending = offset;
        // Do the scroll
        refScroller.current?.scrollTo({
            x: horizontal ? offset : 0,
            y: horizontal ? 0 : offset,
            animated: !!animated,
        });

        if (!animated) {
            refState.current!.scroll = offset;
            // TODO: Should this not be a timeout, and instead wait for all item layouts to settle?
            // It's used for mvcp for when items change size above scroll.
            setTimeout(finishScrollTo, 100);
        }
    };

    const doMaintainScrollAtEnd = (animated: boolean) => {
        const state = refState.current;
        // Run this only if scroll is at the bottom and after initial layout
        if (state?.isAtEnd && maintainScrollAtEnd && peek$(ctx, "containersDidLayout")) {
            // Set scroll to the bottom of the list so that checkAtTop/checkAtBottom is correct
            const paddingTop = peek$(ctx, "alignItemsPaddingTop");
            if (paddingTop > 0) {
                // if paddingTop exists, list is shorter then a screen, so scroll should be 0 anyways
                state.scroll = 0;
            }

            requestAnimationFrame(() => {
                state.maintainingScrollAtEnd = true;
                refScroller.current?.scrollToEnd({
                    animated,
                });
                setTimeout(
                    () => {
                        state.maintainingScrollAtEnd = false;
                    },
                    animated ? 500 : 0,
                );
            });

            return true;
        }
    };

    const checkThreshold = (
        distance: number,
        atThreshold: boolean,
        threshold: number,
        isReached: boolean,
        isBlockedByTimer: boolean,
        onReached?: (distance: number) => void,
        blockTimer?: (block: boolean) => void,
    ) => {
        const distanceAbs = Math.abs(distance);
        const isAtThreshold = atThreshold || distanceAbs < threshold;

        if (!isReached && !isBlockedByTimer) {
            if (isAtThreshold) {
                onReached?.(distance);
                blockTimer?.(true);
                setTimeout(() => {
                    blockTimer?.(false);
                }, 700);
                return true;
            }
        } else {
            // reset flag when user scrolls back out of the threshold
            // add hysteresis to avoid multiple events triggered
            if (distance >= 1.3 * threshold) {
                return false;
            }
        }
        return isReached;
    };

    const checkAtBottom = () => {
        if (!refState.current) {
            return;
        }
        const { queuedInitialLayout, scrollLength, scroll, maintainingScrollAtEnd } = refState.current;
        const contentSize = getContentSize(ctx);
        if (contentSize > 0 && queuedInitialLayout && !maintainingScrollAtEnd) {
            // Check if at end
            const distanceFromEnd = contentSize - scroll - scrollLength;
            const isContentLess = contentSize < scrollLength;
            refState.current.isAtEnd = isContentLess || distanceFromEnd < scrollLength * maintainScrollAtEndThreshold;

            refState.current.isEndReached = checkThreshold(
                distanceFromEnd,
                isContentLess,
                onEndReachedThreshold! * scrollLength,
                refState.current.isEndReached,
                refState.current.endReachedBlockedByTimer,
                (distance) => callbacks.current.onEndReached?.({ distanceFromEnd: distance }),
                (block) => {
                    refState.current!.endReachedBlockedByTimer = block;
                },
            );
        }
    };

    const checkAtTop = () => {
        if (!refState.current) {
            return;
        }
        const { scrollLength, scroll } = refState.current;
        const distanceFromTop = scroll;
        refState.current.isAtStart = distanceFromTop <= 0;

        refState.current.isStartReached = checkThreshold(
            distanceFromTop,
            false,
            onStartReachedThreshold! * scrollLength,
            refState.current.isStartReached,
            refState.current.startReachedBlockedByTimer,
            (distance) => callbacks.current.onStartReached?.({ distanceFromStart: distance }),
            (block) => {
                refState.current!.startReachedBlockedByTimer = block;
            },
        );
    };

    const checkResetContainers = (isFirst: boolean) => {
        const state = refState.current;
        if (state) {
            state.data = dataProp;

            if (!isFirst) {
                calculateItemsInView({ dataChanged: true, doMVCP: true });

                const didMaintainScrollAtEnd = doMaintainScrollAtEnd(false);

                // Reset the endReached flag if new data has been added and we didn't
                // just maintain the scroll at end
                if (!didMaintainScrollAtEnd && dataProp.length > state.data.length) {
                    state.isEndReached = false;
                }

                if (!didMaintainScrollAtEnd) {
                    checkAtTop();
                    checkAtBottom();
                }
            }
        }
    };

    const updateTotalSize = () => {
        const { data, positions } = refState.current!;

        if (data.length === 0) {
            addTotalSize(null, 0);
        } else {
            const lastId = getId(data.length - 1);
            if (lastId !== undefined) {
                const lastPosition = positions.get(lastId);
                if (lastPosition !== undefined) {
                    const lastSize = getItemSize(lastId, data.length - 1, data[dataProp.length - 1]);
                    if (lastSize !== undefined) {
                        const totalSize = lastPosition + lastSize;
                        addTotalSize(null, totalSize);
                    }
                }
            }
        }
    };

    const findAvailableContainers = (
        numNeeded: number,
        startBuffered: number,
        endBuffered: number,
        pendingRemoval: number[],
    ): number[] => {
        const state = refState.current!;
        const numContainers = peek$(ctx, "numContainers") as number;

        const result: number[] = [];
        const availableContainers: Array<{ index: number; distance: number }> = [];

        // First pass: collect unallocated containers (most efficient to use)
        for (let u = 0; u < numContainers; u++) {
            const key = peek$(ctx, `containerItemKey${u}`);
            let isOk = key === undefined;
            if (!isOk) {
                const index = pendingRemoval.indexOf(u);
                if (index !== -1) {
                    pendingRemoval.splice(index, 1);
                    isOk = true;
                }
            }
            // Hasn't been allocated yet or is pending removal, so use it
            if (isOk) {
                result.push(u);
                if (result.length >= numNeeded) {
                    return result; // Early exit if we have enough unallocated containers
                }
            }
        }

        // Second pass: collect containers that are out of view
        for (let u = 0; u < numContainers; u++) {
            const key = peek$(ctx, `containerItemKey${u}`);
            if (key === undefined) continue; // Skip already collected containers

            const index = state.indexByKey.get(key)!;
            if (index < startBuffered) {
                availableContainers.push({ index: u, distance: startBuffered - index });
            } else if (index > endBuffered) {
                availableContainers.push({ index: u, distance: index - endBuffered });
            }
        }

        // If we need more containers than we have available so far
        const remaining = numNeeded - result.length;
        if (remaining > 0) {
            if (availableContainers.length > 0) {
                // Only sort if we need to
                if (availableContainers.length > remaining) {
                    // Sort by distance (furthest first)
                    availableContainers.sort(comparatorByDistance);
                    // Take just what we need
                    availableContainers.length = remaining;
                }

                // Add to result, keeping track of original indices
                for (const container of availableContainers) {
                    result.push(container.index);
                }
            }

            // If we still need more, create new containers
            const stillNeeded = numNeeded - result.length;
            if (stillNeeded > 0) {
                for (let i = 0; i < stillNeeded; i++) {
                    result.push(numContainers + i);
                }

                if (__DEV__ && numContainers + stillNeeded > peek$(ctx, "numContainersPooled")) {
                    console.warn(
                        "[legend-list] No unused container available, so creating one on demand. This can be a minor performance issue and is likely caused by the estimatedItemSize being too large. Consider decreasing estimatedItemSize or increasing initialContainerPoolRatio.",
                        {
                            debugInfo: {
                                numContainers,
                                numNeeded,
                                stillNeeded,
                                numContainersPooled: peek$(ctx, "numContainersPooled"),
                            },
                        },
                    );
                }
            }
        }

        // Sort by index for consistent ordering
        return result.sort(comparatorDefault);
    };

    const isFirst = !refState.current.renderItem;

    const memoizedLastItemKeys = useMemo(() => {
        if (!dataProp.length) return [];
        return Array.from({ length: Math.min(numColumnsProp, dataProp.length) }, (_, i) =>
            getId(dataProp.length - 1 - i),
        );
    }, [dataProp, numColumnsProp]);

    // Run first time and whenever data changes
    const initalizeStateVars = () => {
        set$(ctx, "lastItemKeys", memoizedLastItemKeys);
        set$(ctx, "numColumns", numColumnsProp);

        // If the stylePaddingTop has changed, scroll to an adjusted offset to
        // keep the same content in view
        const prevPaddingTop = peek$(ctx, "stylePaddingTop");
        setPaddingTop({ stylePaddingTop: stylePaddingTopState });
        refState.current!.stylePaddingBottom = stylePaddingBottomState;

        const paddingDiff = stylePaddingTopState - prevPaddingTop;
        // If the style padding has changed then adjust the paddingTop and update scroll to compensate
        // Only iOS seems to need the scroll compensation
        if (paddingDiff && prevPaddingTop !== undefined && Platform.OS === "ios") {
            requestAdjust(paddingDiff);
        }
    };
    if (isFirst) {
        initalizeStateVars();
        updateAllPositions();
    }
    const initialContentOffset = useMemo(() => {
        const initialContentOffset = initialScrollOffset || calculateOffsetForIndex(initialScrollIndex);
        refState.current!.isStartReached =
            initialContentOffset < refState.current!.scrollLength * onStartReachedThreshold!;

        if (initialContentOffset > 0) {
            scrollTo({ offset: initialContentOffset, animated: false, index: initialScrollIndex });
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
            const measured: { width: number; height: number } = (
                refScroller.current as any
            )?.unstable_getBoundingClientRect?.();
            if (measured) {
                const size = Math.floor(measured[horizontal ? "width" : "height"] * 8) / 8;

                if (size) {
                    handleLayout(measured);
                }
            }
        }
        if (!isFirst) {
            calculateItemsInView({ doMVCP: true });
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
                    scrollToIndex({ ...initialScroll, animated: false });
                }, 17);
            }
        }
    }, []);

    useLayoutEffect(() => {
        const didAllocateContainers = doInitialAllocateContainers();
        if (!didAllocateContainers) {
            checkResetContainers(/*isFirst*/ isFirst);
        }
    }, [dataProp, numColumnsProp]);

    useLayoutEffect(() => {
        set$(ctx, "extraData", extraData);
    }, [extraData]);

    refState.current.renderItem = renderItem!;

    useLayoutEffect(initalizeStateVars, [
        memoizedLastItemKeys.join(","),
        numColumnsProp,
        stylePaddingTopState,
        stylePaddingBottomState,
    ]);

    const getRenderedItem = useCallback((key: string) => {
        const state = refState.current;
        if (!state) {
            return null;
        }

        const { data, indexByKey } = state;

        const index = indexByKey.get(key);

        if (index === undefined) {
            return null;
        }

        const renderItemProp = refState.current!.renderItem;
        let renderedItem: React.ReactNode = null;

        if (renderItemProp) {
            const itemProps = {
                item: data[index],
                index,
                extraData: peek$(ctx, "extraData"),
            };

            renderedItem = React.createElement(renderItemProp, itemProps);
        }

        return { index, item: data[index], renderedItem };
    }, []);

    const doInitialAllocateContainers = () => {
        const state = refState.current!;

        // Allocate containers
        const { scrollLength, data } = state;
        if (scrollLength > 0 && data.length > 0 && !peek$(ctx, "numContainers")) {
            const averageItemSize = getEstimatedItemSize ? getEstimatedItemSize(0, data[0]) : estimatedItemSize;
            const numContainers = Math.ceil((scrollLength + scrollBuffer * 2) / averageItemSize) * numColumnsProp;

            for (let i = 0; i < numContainers; i++) {
                set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                set$(ctx, `containerColumn${i}`, -1);
            }

            set$(ctx, "numContainers", numContainers);
            set$(ctx, "numContainersPooled", numContainers * initialContainerPoolRatio);

            if (!IsNewArchitecture) {
                if (initialScroll) {
                    requestAnimationFrame(() => {
                        // immediate render causes issues with initial index position
                        calculateItemsInView();
                    });
                } else {
                    calculateItemsInView();
                }
            }

            return true;
        }
    };

    useEffect(() => {
        const state = refState.current!;
        const viewability = setupViewability({
            viewabilityConfig,
            viewabilityConfigCallbackPairs,
            onViewableItemsChanged,
        });
        state.viewabilityConfigCallbackPairs = viewability;
        state.enableScrollForNextCalculateItemsInView = !viewability;
    }, [viewabilityConfig, viewabilityConfigCallbackPairs, onViewableItemsChanged]);

    if (!IsNewArchitecture) {
        // Needs to use the initial estimated size on old arch, new arch will come within the useLayoutEffect
        useInit(() => {
            doInitialAllocateContainers();
        });
    }

    const updateOneItemSize = useCallback((itemKey: string, sizeObj: { width: number; height: number }) => {
        const state = refState.current!;
        const { sizes, indexByKey, sizesKnown, data, averageSizes } = state;
        if (!data) return 0;

        const index = indexByKey.get(itemKey)!;
        const prevSize = getItemSize(itemKey, index, data as any);
        const size = Math.floor((horizontal ? sizeObj.width : sizeObj.height) * 8) / 8;

        sizesKnown.set(itemKey, size);

        // Update averages for dev warning
        const itemType = "";
        let averages = averageSizes[itemType];
        if (!averages) {
            averages = averageSizes[itemType] = { num: 0, avg: 0 };
        }
        averages.avg = (averages.avg * averages.num + size) / (averages.num + 1);
        averages.num++;

        if (!prevSize || Math.abs(prevSize - size) > 0.1) {
            sizes.set(itemKey, size);
            return size - prevSize;
        }
        return 0;
    }, []);

    const updateItemSizes = useCallback(
        (itemUpdates: { itemKey: string; sizeObj: { width: number; height: number } }[]) => {
            const state = refState.current!;
            if (!state.data) return;

            let needsRecalculate = false;
            let shouldMaintainScrollAtEnd = false;
            let minIndexSizeChanged: number | undefined;
            let maxOtherAxisSize = peek$(ctx, "otherAxisSize") || 0;

            for (const { itemKey, sizeObj } of itemUpdates) {
                const index = state.indexByKey.get(itemKey)!;
                const prevSizeKnown = state.sizesKnown.get(itemKey);

                const diff = updateOneItemSize(itemKey, sizeObj);
                const size = Math.floor((horizontal ? sizeObj.width : sizeObj.height) * 8) / 8;

                if (diff !== 0) {
                    minIndexSizeChanged =
                        minIndexSizeChanged !== undefined ? Math.min(minIndexSizeChanged, index) : index;

                    // Handle scrolling adjustments
                    if (
                        state.scrollingTo?.viewPosition &&
                        maintainVisibleContentPosition &&
                        index === state.scrollingTo.index
                    ) {
                        requestAdjust(diff * state.scrollingTo.viewPosition);
                    }

                    // Check if item is in view
                    const { startBuffered, endBuffered } = state;
                    needsRecalculate ||= index >= startBuffered && index <= endBuffered;
                    if (!needsRecalculate) {
                        const numContainers = ctx.values.get("numContainers") as number;
                        for (let i = 0; i < numContainers; i++) {
                            if (peek$(ctx, `containerItemKey${i}`) === itemKey) {
                                needsRecalculate = true;
                                break;
                            }
                        }
                    }

                    // Handle other axis size
                    if (state.needsOtherAxisSize) {
                        const otherAxisSize = horizontal ? sizeObj.height : sizeObj.width;
                        maxOtherAxisSize = Math.max(maxOtherAxisSize, otherAxisSize);
                    }

                    // Check if we should maintain scroll at end
                    if (prevSizeKnown !== undefined && Math.abs(prevSizeKnown - size) > 5) {
                        shouldMaintainScrollAtEnd = true;
                    }

                    // Call onItemSizeChanged callback
                    onItemSizeChanged?.({
                        size,
                        previous: size - diff,
                        index,
                        itemKey,
                        itemData: state.data[index],
                    });
                }
            }

            // Update state with minimum changed index
            if (minIndexSizeChanged !== undefined) {
                state.minIndexSizeChanged =
                    state.minIndexSizeChanged !== undefined
                        ? Math.min(state.minIndexSizeChanged, minIndexSizeChanged)
                        : minIndexSizeChanged;
            }

            // Handle dev warning about estimated size
            if (__DEV__ && suggestEstimatedItemSize && minIndexSizeChanged !== undefined) {
                if (state.timeoutSizeMessage) clearTimeout(state.timeoutSizeMessage);
                state.timeoutSizeMessage = setTimeout(() => {
                    state.timeoutSizeMessage = undefined;
                    const num = state.sizesKnown.size;
                    const avg = state.averageSizes[""]?.avg;
                    console.warn(
                        `[legend-list] Based on the ${num} items rendered so far, the optimal estimated size is ${avg}.`,
                    );
                }, 1000);
            }

            const cur = peek$(ctx, "otherAxisSize");
            if (!cur || maxOtherAxisSize > cur) {
                set$(ctx, "otherAxisSize", maxOtherAxisSize);
            }

            const containersDidLayout = peek$(ctx, "containersDidLayout");

            if (containersDidLayout || checkAllSizesKnown()) {
                if (needsRecalculate) {
                    state.scrollForNextCalculateItemsInView = undefined;

                    calculateItemsInView({ doMVCP: true, startIndex: containersDidLayout ? minIndexSizeChanged : 0 });
                }
                if (shouldMaintainScrollAtEnd) {
                    doMaintainScrollAtEnd(false);
                }
            }
        },
        [],
    );

    const updateItemSize = useCallback((itemKey: string, sizeObj: { width: number; height: number }) => {
        if (IsNewArchitecture) {
            const { sizesKnown } = refState.current!;
            const numContainers = ctx.values.get("numContainers") as number;
            const changes: { itemKey: string; sizeObj: { width: number; height: number } }[] = [];

            // Run through all containers and if we don't already have a known size then measure the item
            // This is useful because when multiple items render in one frame, the first container fires a
            // useLayoutEffect and we can measure all containers before their useLayoutEffects fire after a delay.
            // This lets use fix any gaps/overlaps that might be visible before the useLayoutEffects fire for each container.
            for (let i = 0; i < numContainers; i++) {
                const containerItemKey = peek$(ctx, `containerItemKey${i}`);
                if (itemKey === containerItemKey) {
                    // If it's this item just use the param
                    changes.push({ itemKey, sizeObj });
                } else if (!sizesKnown.has(containerItemKey) && containerItemKey !== undefined) {
                    const containerRef = ctx.viewRefs.get(i);
                    if (containerRef) {
                        const measured: { width: number; height: number } = (
                            containerRef.current as any
                        )?.unstable_getBoundingClientRect?.();

                        if (measured) {
                            changes.push({ itemKey: containerItemKey, sizeObj: measured });
                        }
                    }
                }
            }

            if (changes.length > 0) {
                updateItemSizes(changes);
            }
        } else {
            updateItemSizes([{ itemKey, sizeObj }]);
        }
    }, []);

    const handleLayout = useCallback((size: { width: number; height: number }) => {
        const scrollLength = size[horizontal ? "width" : "height"];
        const otherAxisSize = size[horizontal ? "height" : "width"];
        const state = refState.current!;
        const didChange = scrollLength !== state.scrollLength;
        const prevOtherAxisSize = state.otherAxisSize;
        state.scrollLength = scrollLength;
        state.otherAxisSize = otherAxisSize;
        state.lastBatchingAction = Date.now();
        state.scrollForNextCalculateItemsInView = undefined;

        doInitialAllocateContainers();

        if (didChange) {
            calculateItemsInView({ doMVCP: true });
        }
        if (didChange || otherAxisSize !== prevOtherAxisSize) {
            set$(ctx, "scrollSize", { width: size.width, height: size.height });
        }

        doMaintainScrollAtEnd(false);
        updateAlignItemsPaddingTop();
        checkAtBottom();
        checkAtTop();

        if (refState.current) {
            // If otherAxisSize minus padding is less than 10, we need to set the size of the other axis
            // from the item height. 10 is just a magic number to account for border/outline or rounding errors.
            refState.current.needsOtherAxisSize = otherAxisSize - (stylePaddingTopState || 0) < 10;
        }

        if (__DEV__ && scrollLength === 0) {
            warnDevOnce(
                "height0",
                `List ${
                    horizontal ? "width" : "height"
                } is 0. You may need to set a style or \`flex: \` for the list, because children are absolutely positioned.`,
            );
        }

        calculateItemsInView({ doMVCP: true });

        setCanRender(true);
    }, []);

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        const layout = event.nativeEvent.layout;
        handleLayout(layout);

        if (onLayoutProp) {
            onLayoutProp(event);
        }
    }, []);

    const handleScroll = useCallback(
        (event: {
            nativeEvent: NativeScrollEvent;
        }) => {
            if (event.nativeEvent?.contentSize?.height === 0 && event.nativeEvent.contentSize?.width === 0) {
                return;
            }
            const state = refState.current!;
            const newScroll = event.nativeEvent.contentOffset[horizontal ? "x" : "y"];

            // Ignore scroll events that are too close to the previous scroll position
            // after adjusting for MVCP
            const ignoreScrollFromMVCP = state.ignoreScrollFromMVCP;
            if (ignoreScrollFromMVCP && !state.scrollingTo) {
                const { lt, gt } = ignoreScrollFromMVCP;
                if ((lt && newScroll < lt) || (gt && newScroll > gt)) {
                    return;
                }
            }

            state.scrollPending = newScroll;

            updateScroll(newScroll);

            state.onScroll?.(event as NativeSyntheticEvent<NativeScrollEvent>);
        },
        [],
    );

    const updateScroll = useCallback((newScroll: number) => {
        const state = refState.current!;
        const scrollingTo = state.scrollingTo;

        state.hasScrolled = true;
        state.lastBatchingAction = Date.now();
        const currentTime = performance.now();

        // Don't add to the history if it's initial scroll event otherwise invalid velocity will be calculated
        // Don't add to the history if we are scrolling to an offset
        if (scrollingTo === undefined && !(state.scrollHistory.length === 0 && newScroll === state.scroll)) {
            // Update scroll history
            state.scrollHistory.push({ scroll: newScroll, time: currentTime });
        }

        // Keep only last 5 entries
        if (state.scrollHistory.length > 5) {
            state.scrollHistory.shift();
        }

        // Update current scroll state
        state.scrollPrev = state.scroll;
        state.scrollPrevTime = state.scrollTime;
        state.scroll = newScroll;
        state.scrollTime = currentTime;
        // Use velocity to predict scroll position
        calculateItemsInView();
        checkAtBottom();
        checkAtTop();
    }, []);

    useImperativeHandle(
        forwardedRef,
        () => {
            const scrollIndexIntoView = (options: Parameters<LegendListRef["scrollIndexIntoView"]>[0]) => {
                if (refState.current) {
                    const { index, ...rest } = options;
                    const { startNoBuffer, endNoBuffer } = refState.current;
                    if (index < startNoBuffer || index > endNoBuffer) {
                        const viewPosition = index < startNoBuffer ? 0 : 1;
                        scrollToIndex({
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
                              sizeAtIndex: (index: number) => state.sizesKnown.get(getId(index))!,
                          }
                        : ({} as ScrollState);
                },
                scrollIndexIntoView,
                scrollItemIntoView: ({ item, ...props }) => {
                    const { data } = refState.current!;
                    const index = data.indexOf(item);
                    if (index !== -1) {
                        scrollIndexIntoView({ index, ...props });
                    }
                },
                scrollToIndex,
                scrollToItem: ({ item, ...props }) => {
                    const { data } = refState.current!;
                    const index = data.indexOf(item);
                    if (index !== -1) {
                        scrollToIndex({ index, ...props });
                    }
                },
                scrollToOffset: (params) => scrollTo(params),
                scrollToEnd: (options) => {
                    const { data, stylePaddingBottom } = refState.current!;
                    const index = data.length - 1;
                    if (index !== -1) {
                        const paddingBottom = stylePaddingBottom || 0;
                        const footerSize = peek$(ctx, "footerSize") || 0;
                        scrollToIndex({
                            index,
                            viewPosition: 1,
                            viewOffset: -paddingBottom - footerSize,
                            ...options,
                        });
                    }
                },
            };
        },
        [],
    );

    if (Platform.OS === "web") {
        useEffect(() => {
            if (initialContentOffset) {
                scrollTo({ offset: initialContentOffset, animated: false });
            }
        }, []);
    }

    return (
        <>
            <ListComponent
                {...rest}
                canRender={canRender}
                horizontal={horizontal!}
                refScrollView={combinedRef}
                initialContentOffset={initialContentOffset}
                getRenderedItem={getRenderedItem}
                updateItemSize={updateItemSize}
                handleScroll={handleScroll}
                onMomentumScrollEnd={(event) => {
                    requestAnimationFrame(() => {
                        finishScrollTo();
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
            />
            {__DEV__ && ENABLE_DEBUG_VIEW && <DebugView state={refState.current!} />}
        </>
    );
});
