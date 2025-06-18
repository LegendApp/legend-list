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
import {
    Dimensions,
    type LayoutChangeEvent,
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
import { ANCHORED_POSITION_OUT_OF_VIEW, ENABLE_DEBUG_VIEW, IsNewArchitecture, POSITION_OUT_OF_VIEW } from "./constants";
import { comparatorByDistance, comparatorDefault, extractPadding, warnDevOnce } from "./helpers";
import { StateProvider, getContentSize, listen$, peek$, set$, useStateContext } from "./state";
import type {
    AnchoredPosition,
    ColumnWrapperStyle,
    InternalState,
    LegendListProps,
    LegendListRef,
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
        initialScrollIndex,
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

    const refLoadStartTime = useRef<number>(Date.now());

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

    // Padding top is handled by PaddingAndAdjust so remove it from the style
    if (style?.paddingTop) {
        style.paddingTop = undefined;
    }
    if (contentContainerStyle?.paddingTop) {
        contentContainerStyle.paddingTop = undefined;
    }

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
        const data = refState.current?.data;
        if (!data) {
            return "";
        }
        const ret = index < data.length ? (keyExtractor ? keyExtractor(data[index], index) : index) : null;
        return `${ret}`;
    };

    const getItemSize = (key: string, index: number, data: T, useAverageSize = false) => {
        const state = refState.current!;
        const sizeKnown = state.sizesKnown.get(key)!;
        // Note: Can't return sizeKnown because it will throw off the total size calculations
        // because this is called in updateItemSize
        const sizePrevious = state.sizes.get(key)!;
        let size: number | undefined;
        const numColumns = peek$(ctx, "numColumns");

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

        if (size === undefined && sizePrevious !== undefined) {
            // If we already have a cached size, use it
            return sizePrevious;
        }

        // Get estimated size if we don't have an average or already cached size
        if (size === undefined) {
            size = getEstimatedItemSize ? getEstimatedItemSize(index, data) : estimatedItemSize;
        }

        // Save to rendered sizes
        state.sizes.set(key, size);
        return size;
    };
    const calculateOffsetForIndex = (indexParam: number | undefined) => {
        const isFromInit = indexParam === undefined;
        const index = isFromInit ? initialScrollIndex : indexParam;
        // This function is called before refState is initialized, so we need to use dataProp
        const data = dataProp;
        if (index !== undefined) {
            let offset = 0;
            const canGetSize = !!refState.current;
            if (canGetSize || getEstimatedItemSize) {
                const sizeFn = (index: number) => {
                    if (canGetSize) {
                        return getItemSize(getId(index), index, data[index], true);
                    }
                    return getEstimatedItemSize!(index, data[index]);
                };
                for (let i = 0; i < index; i++) {
                    offset += sizeFn(i);
                }
            } else {
                offset = index * estimatedItemSize;
            }

            const adjust = peek$(ctx, "containersDidLayout")
                ? refState.current?.scrollAdjustHandler.getAppliedAdjust() || 0
                : 0;

            const stylePaddingTop = isFromInit ? stylePaddingTopState : peek$(ctx, "stylePaddingTop");
            const topPad = (stylePaddingTop ?? 0) + peek$(ctx, "headerSize");

            return offset / numColumnsProp - adjust + topPad;
        }
        return 0;
    };

    const initialContentOffset = initialScrollOffset ?? useMemo(() => calculateOffsetForIndex(undefined), []);

    if (!refState.current) {
        const initialScrollLength = Dimensions.get("window")[horizontal ? "width" : "height"];
        refState.current = {
            sizes: new Map(),
            positions: new Map(),
            columns: new Map(),
            pendingAdjust: 0,
            isStartReached: initialContentOffset < initialScrollLength * onStartReachedThreshold!,
            isEndReached: false,
            isAtEnd: false,
            isAtStart: false,
            data: dataProp,
            scrollLength: initialScrollLength,
            startBuffered: -1,
            startNoBuffer: -1,
            endBuffered: -1,
            endNoBuffer: -1,
            scroll: initialContentOffset || 0,
            totalSize: 0,
            totalSizeBelowAnchor: 0,
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
            scrollVelocity: 0,
            sizesKnown: new Map(),
            timeoutSizeMessage: 0,
            scrollTimer: undefined,
            belowAnchorElementPositions: undefined,
            rowHeights: new Map(),
            startReachedBlockedByTimer: false,
            endReachedBlockedByTimer: false,
            scrollForNextCalculateItemsInView: undefined,
            enableScrollForNextCalculateItemsInView: true,
            minIndexSizeChanged: 0,
            queuedCalculateItemsInView: 0,
            lastBatchingAction: Date.now(),
            averageSizes: {},
            onScroll: onScrollProp,
        };

        const dataLength = dataProp.length;

        if (maintainVisibleContentPosition && dataLength > 0) {
            if (initialScrollIndex && initialScrollIndex < dataLength) {
                refState.current!.anchorElement = {
                    coordinate: initialContentOffset,
                    id: getId(initialScrollIndex),
                };
            } else if (dataLength > 0) {
                refState.current!.anchorElement = {
                    coordinate: initialContentOffset,
                    id: getId(0),
                };
            } else {
                __DEV__ &&
                    warnDevOnce(
                        "maintainVisibleContentPosition",
                        "[legend-list] maintainVisibleContentPosition was not able to find an anchor element",
                    );
            }
        }
        set$(ctx, "scrollAdjust", 0);
        set$(ctx, "maintainVisibleContentPosition", maintainVisibleContentPosition);
        set$(ctx, "extraData", extraData);
    }

    const didDataChange = refState.current.data !== dataProp;
    refState.current.data = dataProp;
    refState.current.onScroll = onScrollProp;

    const getAnchorElementIndex = () => {
        const state = refState.current!;
        if (state.anchorElement) {
            const el = state.indexByKey.get(state.anchorElement.id);
            return el;
        }
        return undefined;
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
        if (isLast && viewPosition !== undefined) {
            viewPosition = 1;
        }
        let firstIndexScrollPostion = firstIndexOffset - viewOffset;
        const diff = Math.abs(state.scroll - firstIndexScrollPostion);
        const topPad = peek$(ctx, "stylePaddingTop") + peek$(ctx, "headerSize");

        // TODO: include checking if destination element position is already known, to avoid unneeded anchor element switches
        const needsReanchoring = maintainVisibleContentPosition && diff > 100;
        state.scrollForNextCalculateItemsInView = undefined;

        if (needsReanchoring) {
            // in the maintainVisibleContentPosition we can choose element we are scrolling to as anchor element
            // now let's cleanup old positions and set new anchor element
            const id = getId(index);
            state.anchorElement = { id, coordinate: firstIndexOffset - topPad };
            state.belowAnchorElementPositions?.clear();
            state.positions.clear();
            calcTotalSizesAndPositions({ forgetPositions: true }); // since we are choosing new anchor, we need to recalulate positions
            state.startBufferedId = id;
            state.minIndexSizeChanged = index;

            // when doing scrollTo, it's important to use latest adjust value
            firstIndexScrollPostion = firstIndexOffset - viewOffset + state.scrollAdjustHandler.getAppliedAdjust();
        }

        // Disable scroll adjust while scrolling so that it doesn't do extra work affecting the target offset
        // Do the scroll
        scrollTo({ offset: firstIndexScrollPostion, animated, index, viewPosition: viewPosition ?? 0, viewOffset });
    };

    const setDidLayout = () => {
        refState.current!.queuedInitialLayout = true;
        checkAtBottom();
        const setIt = () => {
            set$(ctx, "containersDidLayout", true);

            if (props.onLoad) {
                props.onLoad({ elapsedTimeInMs: Date.now() - refLoadStartTime.current });
            }
        };
        if (initialScrollIndex) {
            queueMicrotask(() => {
                scrollToIndex({ index: initialScrollIndex, animated: false });
                requestAnimationFrame(() => {
                    // Old architecture sometimes doesn't scroll to the initial index correctly
                    if (!IsNewArchitecture) {
                        scrollToIndex({ index: initialScrollIndex, animated: false });
                    }

                    setIt();
                });
            });
        } else {
            queueMicrotask(setIt);
        }
    };

    const addTotalSize = useCallback((key: string | null, add: number, totalSizeBelowAnchor: number) => {
        const state = refState.current!;
        const { indexByKey, anchorElement } = state;
        const index = key === null ? 0 : indexByKey.get(key)!;
        let isAboveAnchor = false;
        if (maintainVisibleContentPosition) {
            if (anchorElement && index < getAnchorElementIndex()!) {
                isAboveAnchor = true;
            }
        }
        if (key === null) {
            state.totalSize = add;
            state.totalSizeBelowAnchor = totalSizeBelowAnchor;
        } else {
            state.totalSize += add;
            if (isAboveAnchor) {
                state.totalSizeBelowAnchor! += add;
            }
        }

        let applyAdjustValue = 0;
        let resultSize = state.totalSize;

        if (maintainVisibleContentPosition && anchorElement !== undefined) {
            const newAdjust = anchorElement.coordinate - state.totalSizeBelowAnchor;
            applyAdjustValue = -newAdjust;
            state.belowAnchorElementPositions = buildElementPositionsBelowAnchor();
            state.rowHeights.clear();

            if (applyAdjustValue !== undefined) {
                resultSize -= applyAdjustValue;
                state.scrollAdjustHandler.requestAdjust(applyAdjustValue, (diff: number) => {
                    // event state.scroll will contain invalid value, until next handleScroll
                    // apply adjustment
                    state.scroll -= diff;
                });
            }
        }

        set$(ctx, "totalSize", state.totalSize);
        set$(ctx, "totalSizeWithScrollAdjust", resultSize);

        if (alignItemsAtEnd) {
            updateAlignItemsPaddingTop();
        }
    }, []);

    const getRowHeight = (n: number): number => {
        const { rowHeights, data } = refState.current!;
        const numColumns = peek$(ctx, "numColumns");
        if (numColumns === 1) {
            const id = getId(n);
            return getItemSize(id, n, data[n]);
        }
        if (rowHeights.has(n)) {
            return rowHeights.get(n) || 0;
        }
        let rowHeight = 0;
        const startEl = n * numColumns;
        for (let i = startEl; i < startEl + numColumns && i < data.length; i++) {
            const id = getId(i);
            const size = getItemSize(id, i, data[i]);
            rowHeight = Math.max(rowHeight, size);
        }
        rowHeights.set(n, rowHeight);
        return rowHeight;
    };

    // this function rebuilds its data on each addTotalSize
    // this can be further optimized either by rebuilding part that's changed or by moving achorElement up, keeping number of function iterations minimal
    const buildElementPositionsBelowAnchor = (): Map<string, number> => {
        const state = refState.current!;

        if (!state.anchorElement) {
            return new Map();
        }
        const anchorIndex = state.indexByKey.get(state.anchorElement.id)!;
        if (anchorIndex === 0) {
            return new Map();
        }
        const map = state.belowAnchorElementPositions || new Map();
        const numColumns = peek$(ctx, "numColumns");
        let top = state.anchorElement!.coordinate;
        for (let i = anchorIndex - 1; i >= 0; i--) {
            const id = getId(i);
            const rowNumber = Math.floor(i / numColumns);
            if (i % numColumns === 0) {
                top -= getRowHeight(rowNumber);
            }
            map.set(id, top);
        }
        return map;
    };

    const disableScrollJumps = (timeout: number) => {
        const state = refState.current!;

        // Don't disable scroll jumps if we're not scrolling to an offset
        // Resetting containers can cause a jump, so we don't want to disable scroll jumps in that case
        if (state.scrollingTo === undefined) {
            state.disableScrollJumpsFrom = state.scroll - state.scrollAdjustHandler.getAppliedAdjust();
            state.scrollHistory.length = 0;

            setTimeout(() => {
                state.disableScrollJumpsFrom = undefined;
                if (state.scrollPending !== undefined && state.scrollPending !== state.scroll) {
                    updateScroll(state.scrollPending);
                }
            }, timeout);
        }
    };

    const getElementPositionBelowAchor = (id: string) => {
        const state = refState.current!;
        if (!refState.current!.belowAnchorElementPositions) {
            state.belowAnchorElementPositions = buildElementPositionsBelowAnchor();
        }
        const res = state.belowAnchorElementPositions!.get(id);

        if (res === undefined) {
            console.warn(`Undefined position below anchor ${id} ${state.anchorElement?.id}`);
            return 0;
        }
        return res;
    };

    const fixGaps = useCallback(() => {
        const state = refState.current!;
        const { data, scrollLength, positions, startBuffered, endBuffered } = state!;

        // TODO: Fix behavior with multiple columns and stop returning
        const numColumns = peek$(ctx, "numColumns");
        if (!data || scrollLength === 0 || numColumns > 1) {
            return;
        }
        const numContainers = ctx.values.get("numContainers") as number;
        let numMeasurements = 0;

        // Run through all containers and if we don't already have a known size then measure the item
        // This is useful because when multiple items render in one frame, the first container fires a
        // useLayoutEffect and we can measure all containers before their useLayoutEffects fire after a delay.
        // This lets use fix any gaps/overlaps that might be visible before the useLayoutEffects fire for each container.
        for (let i = 0; i < numContainers; i++) {
            const itemKey = peek$(ctx, `containerItemKey${i}`);
            const isSizeKnown = state.sizesKnown.get(itemKey);
            if (itemKey && !isSizeKnown) {
                const containerRef = ctx.viewRefs.get(i);
                if (containerRef) {
                    let measured: { width: number; height: number } | undefined;
                    containerRef.current?.measure((x, y, width, height) => {
                        measured = { width, height };
                    });
                    numMeasurements++;
                    if (measured) {
                        updateItemSize(itemKey, measured, /*fromFixGaps*/ true);
                    }
                }
            }
        }
        if (numMeasurements > 0) {
            let top: number | undefined;
            const diffs = new Map<string, number>();
            // Calculate the changed position for each item in view
            for (let i = startBuffered; i <= endBuffered; i++) {
                const id = getId(i)!;
                if (top === undefined) {
                    top = positions.get(id);
                }
                if (positions.get(id) !== top) {
                    diffs.set(id, top! - positions.get(id)!);
                    positions.set(id, top!);
                }
                const size = getItemSize(id, i, data[i]);
                const bottom = top! + size;
                top = bottom;
            }

            // Apply the changed positions to the containers
            for (let i = 0; i < numContainers; i++) {
                const itemKey = peek$(ctx, `containerItemKey${i}`);
                const diff = diffs.get(itemKey);
                if (diff) {
                    const prevPos = peek$(ctx, `containerPosition${i}`);
                    const newPos = prevPos.top + diff;
                    if (prevPos.top !== newPos) {
                        const pos = { ...prevPos };
                        pos.relativeCoordinate += diff;
                        pos.top += diff;
                        set$(ctx, `containerPosition${i}`, pos);
                    }
                }
            }
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

    const calculateItemsInView = useCallback((isReset?: boolean) => {
        const state = refState.current!;
        const {
            data,
            scrollLength,
            startBufferedId: startBufferedIdOrig,
            positions,
            columns,
            scrollAdjustHandler,
            scrollVelocity: speed,
        } = state!;
        if (!data || scrollLength === 0) {
            return;
        }

        const totalSize = peek$(ctx, "totalSizeWithScrollAdjust");
        const topPad = peek$(ctx, "stylePaddingTop") + peek$(ctx, "headerSize");
        const numColumns = peek$(ctx, "numColumns");
        const previousScrollAdjust = scrollAdjustHandler.getAppliedAdjust();
        let scrollState = state.scroll;
        const scrollExtra = 0;
        // Disabled this optimization for now because it was causing blanks to appear sometimes
        // We may need to control speed calculation better, or not have a 5 item history to avoid this issue
        // const scrollExtra = Math.max(-16, Math.min(16, speed)) * 24;

        // Don't use averages when disabling scroll jumps because adding items to the top of the list
        // causes jumpiness if using averages
        // TODO Figure out why using average caused jumpiness, maybe we can fix it a better way
        const useAverageSize = !state.disableScrollJumpsFrom && speed >= 0 && peek$(ctx, "containersDidLayout");

        // If this is before the initial layout, and we have an initialScrollIndex,
        // then ignore the actual scroll which might be shifting due to scrollAdjustHandler
        // and use the calculated offset of the initialScrollIndex instead.
        if (!state.queuedInitialLayout && initialScrollIndex) {
            const updatedOffset = calculateOffsetForIndex(initialScrollIndex);
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

        if (Math.abs(speed) > 4) {
            if (speed > 0) {
                scrollBufferTop = scrollBuffer * 0.1;
                scrollBufferBottom = scrollBuffer * 1.9;
            } else {
                scrollBufferTop = scrollBuffer * 1.9;
                scrollBufferBottom = scrollBuffer * 0.1;
            }
        }

        const scrollTopBuffered = scroll - scrollBufferTop;
        const scrollBottom = scroll + scrollLength;
        const scrollBottomBuffered = scrollBottom + scrollBufferBottom;

        // Check precomputed scroll range to see if we can skip this check
        if (state.scrollForNextCalculateItemsInView) {
            const { top, bottom } = state.scrollForNextCalculateItemsInView;
            if (scrollTopBuffered > top && scrollBottomBuffered < bottom) {
                return;
            }
        }

        let startNoBuffer: number | null = null;
        let startBuffered: number | null = null;
        let startBufferedId: string | null = null;
        let endNoBuffer: number | null = null;
        let endBuffered: number | null = null;

        let loopStart: number = startBufferedIdOrig ? state.indexByKey.get(startBufferedIdOrig) || 0 : 0;

        if (state.minIndexSizeChanged !== undefined) {
            loopStart = Math.min(state.minIndexSizeChanged, loopStart);
            state.minIndexSizeChanged = undefined;
        }

        const anchorElementIndex = getAnchorElementIndex()!;

        // Go backwards from the last start position to find the first item that is in view
        // This is an optimization to avoid looping through all items, which could slow down
        // when scrolling at the end of a long list.

        // TODO: Fix this logic for numColumns
        for (let i = loopStart; i >= 0; i--) {
            const id = getId(i)!;
            let newPosition: number | undefined;

            if (maintainVisibleContentPosition && anchorElementIndex && i < anchorElementIndex) {
                newPosition = getElementPositionBelowAchor(id);
                if (newPosition !== undefined) {
                    positions.set(id, newPosition);
                }
            }

            const top = newPosition || positions.get(id)!;

            if (top !== undefined) {
                const size = getItemSize(id, i, data[i], useAverageSize);
                const bottom = top + size;
                if (bottom > scroll - scrollBuffer) {
                    loopStart = i;
                } else {
                    break;
                }
            }
        }

        const loopStartMod = loopStart % numColumns;
        if (loopStartMod > 0) {
            loopStart -= loopStartMod;
        }

        let top: number | undefined = undefined;

        let column = 1;
        let maxSizeInRow = 0;

        const getInitialTop = (i: number): number => {
            const id = getId(i)!;
            let topOffset = 0;
            if (positions.get(id)) {
                topOffset = positions.get(id)!;
            }
            if (id === state.anchorElement?.id) {
                topOffset = state.anchorElement.coordinate;
            }
            return topOffset;
        };

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
                const index = state.indexByKey.get(key)!;
                maxIndexRendered = Math.max(maxIndexRendered, index);
            }
        }

        // scan data forwards
        // Continue until we've found the end and we've updated positions of all items that were previously in view
        for (let i = Math.max(0, loopStart); i < data!.length && (!foundEnd || i <= maxIndexRendered); i++) {
            const id = getId(i)!;
            const size = getItemSize(id, i, data[i], useAverageSize);

            maxSizeInRow = Math.max(maxSizeInRow, size);

            if (top === undefined || id === state.anchorElement?.id) {
                top = getInitialTop(i);
            }

            if (positions.get(id) !== top) {
                positions.set(id, top);
            }

            if (columns.get(id) !== column) {
                columns.set(id, column);
            }

            if (!foundEnd) {
                if (startNoBuffer === null && top + size > scroll) {
                    startNoBuffer = i;
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
                        nextBottom = top + maxSizeInRow - scrollLength;
                    } else {
                        foundEnd = true;
                    }
                }
            }

            column++;
            if (column > numColumns) {
                top += maxSizeInRow;
                column = 1;
                maxSizeInRow = 0;
            }
        }

        Object.assign(state, {
            startBuffered,
            startBufferedId,
            startNoBuffer,
            endBuffered,
            endNoBuffer,
        });

        // Precompute the scroll that will be needed for the range to change
        // so it can be skipped if not needed
        if (
            state.enableScrollForNextCalculateItemsInView &&
            nextTop !== undefined &&
            nextBottom !== undefined &&
            state.disableScrollJumpsFrom === undefined
        ) {
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
        //     scrollAdjustPad,
        //     startBuffered,
        //     startNoBuffer,
        //     endNoBuffer,
        //     endBuffered,
        // );

        if (startBuffered !== null && endBuffered !== null) {
            let numContainers = prevNumContainers;

            const needNewContainers: number[] = [];
            const isContained = (i: number) => {
                const id = getId(i)!;
                // See if this item is already in a container
                for (let j = 0; j < numContainers; j++) {
                    const key = peek$(ctx, `containerItemKey${j}`);
                    if (key === id) {
                        return true;
                    }
                }
            };
            // Note: There was previously an optimization here to only check items that are newly visible
            // but it may have been causing issues with some items not being rendered,
            // and it's likely not enough of a performance improvement to be worth it
            for (let i = startBuffered!; i <= endBuffered; i++) {
                if (!isContained(i)) {
                    needNewContainers.push(i);
                }
            }

            if (needNewContainers.length > 0) {
                const availableContainers = findAvailableContainers(
                    needNewContainers.length,
                    startBuffered,
                    endBuffered,
                );
                for (let idx = 0; idx < needNewContainers.length; idx++) {
                    const i = needNewContainers[idx];
                    const containerIndex = availableContainers[idx];
                    const id = getId(i)!;

                    set$(ctx, `containerItemKey${containerIndex}`, id);
                    set$(ctx, `containerItemData${containerIndex}`, data[i]);

                    if (containerIndex >= numContainers) {
                        numContainers = containerIndex + 1;
                    }

                    // console.log("A", i, containerIndex, id, data[i]);
                }

                if (numContainers !== prevNumContainers) {
                    set$(ctx, "numContainers", numContainers);
                    if (numContainers > peek$(ctx, "numContainersPooled")) {
                        set$(ctx, "numContainersPooled", Math.ceil(numContainers * 1.5));
                    }
                }
            }

            // Update top positions of all containers
            // TODO: This could be optimized to only update the containers that have changed
            // but it likely would have little impact. Remove this comment if not worth doing.
            for (let i = 0; i < numContainers; i++) {
                const itemKey = peek$(ctx, `containerItemKey${i}`);
                const itemIndex = state.indexByKey.get(itemKey)!;
                const item = data[itemIndex];
                if (item !== undefined) {
                    const id = getId(itemIndex);
                    const position = positions.get(id);

                    // console.log("B", i, itemKey, itemIndex, id, position);
                    if (position === undefined) {
                        // This item may have been in view before data changed and positions were reset
                        // so we need to set it to out of view
                        set$(ctx, `containerPosition${i}`, ANCHORED_POSITION_OUT_OF_VIEW);
                    } else {
                        const pos: AnchoredPosition = {
                            type: "top",
                            relativeCoordinate: positions.get(id)!,
                            top: positions.get(id)!,
                        };
                        const column = columns.get(id) || 1;

                        // anchor elements to the bottom if element is below anchor
                        if (maintainVisibleContentPosition && itemIndex < anchorElementIndex) {
                            const currentRow = Math.floor(itemIndex / numColumns);
                            const rowHeight = getRowHeight(currentRow);
                            const elementHeight = getItemSize(id, itemIndex, data[i]);
                            const diff = rowHeight - elementHeight; // difference between row height and element height
                            pos.relativeCoordinate = pos.top + getRowHeight(currentRow) - diff;
                            pos.type = "bottom";
                        }

                        const prevPos = peek$(ctx, `containerPosition${i}`);
                        const prevColumn = peek$(ctx, `containerColumn${i}`);
                        const prevData = peek$(ctx, `containerItemData${i}`);

                        if (!prevPos || (pos.relativeCoordinate > POSITION_OUT_OF_VIEW && pos.top !== prevPos.top)) {
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

        if (!state.queuedInitialLayout && endBuffered !== null) {
            // If waiting for initial layout and all items in view have a known size then
            // initial layout is complete
            if (checkAllSizesKnown()) {
                setDidLayout();
            }
        }

        if (state.viewabilityConfigCallbackPairs) {
            updateViewableItems(
                state,
                ctx,
                state.viewabilityConfigCallbackPairs,
                getId,
                scrollLength,
                startNoBuffer!,
                endNoBuffer!,
            );
        }
    }, []);

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
                const prevTotalSize = peek$(ctx, "totalSizeWithScrollAdjust") || 0;
                set$(ctx, "totalSizeWithScrollAdjust", prevTotalSize + prevStylePaddingTop);
                setTimeout(() => {
                    // Then reset it back to how it was
                    set$(ctx, "totalSizeWithScrollAdjust", prevTotalSize);
                }, 16);
            }

            // Now set the padding
            set$(ctx, "stylePaddingTop", stylePaddingTop);
        }
        if (alignItemsPaddingTop !== undefined) {
            set$(ctx, "alignItemsPaddingTop", alignItemsPaddingTop);
        }

        set$(
            ctx,
            "paddingTop",
            (stylePaddingTop ?? peek$(ctx, "stylePaddingTop")) +
                (alignItemsPaddingTop ?? peek$(ctx, "alignItemsPaddingTop")),
        );
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
            state.scrollAdjustHandler.setDisableAdjust(false);
            state.scrollHistory.length = 0;
            calculateItemsInView();
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
        const { animated, index, viewPosition, viewOffset } = params;
        let { offset } = params;

        if (viewOffset) {
            offset -= viewOffset;
        }

        if (viewPosition !== undefined && index !== undefined) {
            // TODO: This can be inaccurate if the item size is very different from the estimatedItemSize
            // In the future we can improve this by listening for the item size change and then updating the scroll position
            offset -= viewPosition * (state.scrollLength - getItemSize(getId(index), index, state.data[index]));
        }

        // Disable scroll adjust while scrolling so that it doesn't do extra work affecting the target offset
        state.scrollAdjustHandler.setDisableAdjust(true);
        state.scrollHistory.length = 0;
        state.scrollingTo = params;
        // Do the scroll
        refScroller.current?.scrollTo({
            x: horizontal ? offset : 0,
            y: horizontal ? 0 : offset,
            animated: !!animated,
        });

        if (!animated) {
            requestAnimationFrame(finishScrollTo);
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

            state.disableScrollJumpsFrom = undefined;

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
                // Disable scroll jumps if the scroll has jumped by the same amount as the total size
                const totalSizeBefore = state.previousTotalSize;
                const totalSizeAfter = state.totalSize;
                const scrollDiff = state.scroll - state.scrollPrev;
                const sizeDiff = totalSizeAfter - totalSizeBefore!;

                if (Math.abs(scrollDiff - sizeDiff) < 10) {
                    disableScrollJumps(1000);
                }

                // Reset containers that aren't used anymore because the data has changed
                const numContainers = peek$(ctx, "numContainers");
                for (let i = 0; i < numContainers; i++) {
                    const itemKey = peek$(ctx, `containerItemKey${i}`);
                    if (!keyExtractorProp || (itemKey && state.indexByKey.get(itemKey) === undefined)) {
                        set$(ctx, `containerItemKey${i}`, undefined);
                        set$(ctx, `containerItemData${i}`, undefined);
                        set$(ctx, `containerPosition${i}`, ANCHORED_POSITION_OUT_OF_VIEW);
                        set$(ctx, `containerColumn${i}`, -1);
                    }
                }

                if (!keyExtractorProp) {
                    state.positions.clear();
                }

                calculateItemsInView(/*isReset*/ true);

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

    const calcTotalSizesAndPositions = ({ forgetPositions = false }) => {
        const state = refState.current;
        let totalSize = 0;
        let totalSizeBelowIndex = 0;
        const indexByKey = new Map();
        const newPositions = new Map();
        let column = 1;
        let maxSizeInRow = 0;
        const numColumns = peek$(ctx, "numColumns") ?? numColumnsProp;

        if (!state) {
            return;
        }

        for (let i = 0; i < dataProp.length; i++) {
            const key = getId(i);
            if (__DEV__) {
                if (indexByKey.has(key)) {
                    console.error(
                        `[legend-list] Error: Detected overlapping key (${key}) which causes missing items and gaps and other terrrible things. Check that keyExtractor returns unique values.`,
                    );
                }
            }
            indexByKey.set(key, i);
            // save positions for items that are still in the list at the same indices
            // throw out everything else
            if (!forgetPositions && state.positions.get(key) != null && state.indexByKey.get(key) === i) {
                newPositions.set(key, state.positions.get(key)!);
            }
        }
        // getAnchorElementIndex needs indexByKey, build it first
        state.indexByKey = indexByKey;
        state.positions = newPositions;

        if (!forgetPositions && !isFirst) {
            // check if anchorElement is still in the list
            if (maintainVisibleContentPosition) {
                if (state.anchorElement == null || indexByKey.get(state.anchorElement.id) == null) {
                    if (dataProp.length) {
                        const newAnchorElement = {
                            coordinate: 0,
                            id: getId(0),
                        };
                        state.anchorElement = newAnchorElement;
                        state.belowAnchorElementPositions?.clear();
                        // reset scroll to 0 and schedule rerender
                        scrollTo({ offset: 0, animated: false });
                        setTimeout(() => {
                            calculateItemsInView(/*reset*/ true);
                        }, 0);
                    } else {
                        state.startBufferedId = undefined;
                    }
                }
            } else {
                // if maintainVisibleContentPosition not used, reset startBufferedId if it's not in the list
                if (state.startBufferedId != null && newPositions.get(state.startBufferedId) == null) {
                    if (dataProp.length) {
                        state.startBufferedId = getId(0);
                    } else {
                        state.startBufferedId = undefined;
                    }
                    // reset scroll to 0 and schedule rerender
                    scrollTo({ offset: 0, animated: false });
                    setTimeout(() => {
                        calculateItemsInView(/*reset*/ true);
                    }, 0);
                }
            }
        }

        const anchorElementIndex = getAnchorElementIndex();
        for (let i = 0; i < dataProp.length; i++) {
            const key = getId(i);

            const size = getItemSize(key, i, dataProp[i]);
            maxSizeInRow = Math.max(maxSizeInRow, size);

            column++;
            if (column > numColumns) {
                if (maintainVisibleContentPosition && anchorElementIndex !== undefined && i < anchorElementIndex) {
                    totalSizeBelowIndex += maxSizeInRow;
                }

                totalSize += maxSizeInRow;
                column = 1;
                maxSizeInRow = 0;
            }
        }

        if (maxSizeInRow > 0) {
            // If have any height leftover from a row that doesn't extend through the last column
            // add it to total size
            totalSize += maxSizeInRow;
        }
        state.ignoreScrollFromCalcTotal = true;
        requestAnimationFrame(() => {
            state.ignoreScrollFromCalcTotal = false;
        });
        addTotalSize(null, totalSize, totalSizeBelowIndex);
    };

    const findAvailableContainers = (numNeeded: number, startBuffered: number, endBuffered: number): number[] => {
        const state = refState.current!;
        const numContainers = peek$(ctx, "numContainers") as number;

        // Quick return for common case
        if (numNeeded === 0) return [];

        const result: number[] = [];
        const availableContainers: Array<{ index: number; distance: number }> = [];

        // First pass: collect unallocated containers (most efficient to use)
        for (let u = 0; u < numContainers; u++) {
            const key = peek$(ctx, `containerItemKey${u}`);
            // Hasn't been allocated yet, just use it
            if (key === undefined) {
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
            queueMicrotask(() => {
                scrollTo({ offset: refState.current!.scroll + paddingDiff, animated: false });
            });
        }
    };
    if (isFirst) {
        initalizeStateVars();
    }
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

        refState.current.previousTotalSize = peek$(ctx, "totalSize");

        calcTotalSizesAndPositions({ forgetPositions: false });
    }

    useEffect(() => {
        if (initialScrollIndex && ListHeaderComponent) {
            // Once we get a headerSize we need to fix the initial scroll offset
            // to include the headerSize
            const dispose = listen$(ctx, "headerSize", (size) => {
                if (size > 0) {
                    scrollToIndex({ index: initialScrollIndex, animated: false });
                    dispose?.();
                }
            });

            // Dispose after timeout 0 because header should have laid out already.
            // If it didn't we don't want to erroneously scroll sometime later.
            setTimeout(dispose, 0);

            return dispose;
        }
    }, []);

    useEffect(() => {
        const didAllocateContainers = doInitialAllocateContainers();
        if (!didAllocateContainers) {
            checkResetContainers(/*isFirst*/ isFirst);
        }
    }, [dataProp, numColumnsProp]);

    useEffect(() => {
        set$(ctx, "extraData", extraData);
    }, [extraData]);

    refState.current.renderItem = renderItem!;

    // TODO: This needs to support horizontal and other ways of defining padding

    useEffect(initalizeStateVars, [
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
                set$(ctx, `containerPosition${i}`, ANCHORED_POSITION_OUT_OF_VIEW);
                set$(ctx, `containerColumn${i}`, -1);
            }

            set$(ctx, "numContainers", numContainers);
            set$(ctx, "numContainersPooled", numContainers * initialContainerPoolRatio);

            if (initialScrollIndex) {
                requestAnimationFrame(() => {
                    // immediate render causes issues with initial index position
                    calculateItemsInView(/*isReset*/ true);
                });
            } else {
                calculateItemsInView(/*isReset*/ true);
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

    useInit(() => {
        doInitialAllocateContainers();
    });

    const updateItemSize = useCallback(
        (itemKey: string, sizeObj: { width: number; height: number }, fromFixGaps?: boolean) => {
            const state = refState.current!;
            const {
                sizes,
                indexByKey,
                sizesKnown,
                data,
                rowHeights,
                startBuffered,
                endBuffered,
                averageSizes,
                queuedInitialLayout,
            } = state;
            if (!data) {
                return;
            }

            const index = indexByKey.get(itemKey)!;
            const numColumns = peek$(ctx, "numColumns");

            state.scrollForNextCalculateItemsInView = undefined;
            state.minIndexSizeChanged =
                state.minIndexSizeChanged !== undefined ? Math.min(state.minIndexSizeChanged, index) : index;

            const prevSize = getItemSize(itemKey, index, data as any);
            const prevSizeKnown = sizesKnown.get(itemKey);

            let needsCalculate = false;
            let needsUpdateContainersDidLayout = false;

            const size = Math.floor((horizontal ? sizeObj.width : sizeObj.height) * 8) / 8;

            sizesKnown!.set(itemKey, size);

            // TODO: Hook this up to actual item type later once we have item types
            const itemType = "";
            let averages = averageSizes[itemType];
            if (!averages) {
                averages = averageSizes[itemType] = {
                    num: 0,
                    avg: 0,
                };
            }
            averages.avg = (averages.avg * averages.num + size) / (averages.num + 1);
            averages.num++;

            if (!prevSize || Math.abs(prevSize - size) > 0.1) {
                let diff: number;
                needsCalculate = true;

                if (numColumns > 1) {
                    const rowNumber = Math.floor(index / numColumnsProp);
                    const prevSizeInRow = getRowHeight(rowNumber);
                    sizes.set(itemKey, size);
                    rowHeights.delete(rowNumber);

                    const sizeInRow = getRowHeight(rowNumber);
                    diff = sizeInRow - prevSizeInRow;
                } else {
                    sizes.set(itemKey, size);
                    diff = size - prevSize;
                }

                if (__DEV__ && suggestEstimatedItemSize) {
                    if (state.timeoutSizeMessage) {
                        clearTimeout(state.timeoutSizeMessage);
                    }

                    state.timeoutSizeMessage = setTimeout(() => {
                        state.timeoutSizeMessage = undefined;
                        const num = sizesKnown.size;
                        const avg = state.averageSizes[""].avg;

                        console.warn(
                            `[legend-list] estimatedItemSize or getEstimatedItemSize are not defined. Based on the ${num} items rendered so far, the optimal estimated size is ${avg}.`,
                        );
                    }, 1000);
                }

                // Reset scrollForNextCalculateItemsInView because a position may have changed making the previous
                // precomputed scroll range invalid
                state.scrollForNextCalculateItemsInView = undefined;

                addTotalSize(itemKey, diff, 0);

                // Maintain scroll at end if this item has already rendered and is changing by more than 5px
                // This prevents a bug where the list will scroll to the bottom when scrolling up and an item lays out
                if (prevSizeKnown !== undefined && Math.abs(prevSizeKnown - size) > 5) {
                    doMaintainScrollAtEnd(false); // *animated*/ index === data.length - 1);
                }

                if (onItemSizeChanged) {
                    onItemSizeChanged({
                        size,
                        previous: prevSize,
                        index,
                        itemKey,
                        itemData: data[index],
                    });
                }
            }

            if (!queuedInitialLayout && checkAllSizesKnown()) {
                needsUpdateContainersDidLayout = true;
            }

            // We can skip calculating items in view if they have already gone out of view. This can happen on slow
            // devices or when the list is scrolled quickly.
            let isInView = index >= startBuffered && index <= endBuffered;

            if (!isInView) {
                // If not in the range it could be in a container that's offscreen but not yet recycled
                const numContainers = ctx.values.get("numContainers") as number;

                for (let i = 0; i < numContainers; i++) {
                    if (peek$(ctx, `containerItemKey${i}`) === itemKey) {
                        isInView = true;
                        break;
                    }
                }
            }

            if (
                needsUpdateContainersDidLayout ||
                (!fromFixGaps && needsCalculate && (isInView || !queuedInitialLayout))
            ) {
                const scrollVelocity = state.scrollVelocity;
                let didCalculate = false;

                // TODO: The second part of this if should be merged into the previous if
                // Can this be less complex in general?
                if (
                    (Number.isNaN(scrollVelocity) || Math.abs(scrollVelocity) < 1 || state.scrollingTo !== undefined) &&
                    (!waitForInitialLayout || needsUpdateContainersDidLayout || queuedInitialLayout)
                ) {
                    // Calculate positions if not currently scrolling and not waiting on other items to layout
                    if (Date.now() - state.lastBatchingAction < 500) {
                        // If this item layout is within 500ms of the most recent list layout, scroll, or column change,
                        // batch calculations from layout to reduce the number of computations and renders.
                        // This heuristic is basically to determine whether this comes from an internal List action or an external component action.
                        // Batching adds a slight delay so this ensures that calculation is batched only if
                        // it's likely that multiple items will have changed size and a one frame delay is acceptable,
                        // such as when items are changed, the list changed size, or during scrolling.
                        if (!state.queuedCalculateItemsInView) {
                            state.queuedCalculateItemsInView = requestAnimationFrame(() => {
                                state.queuedCalculateItemsInView = undefined;
                                calculateItemsInView();
                            });
                        }
                    } else {
                        // Otherwise this action is likely from a single item changing so it should run immediately
                        calculateItemsInView();
                        didCalculate = true;
                    }
                }

                // If this did not trigger a full calculate we should fix any gaps/overlaps
                if (!didCalculate && !needsUpdateContainersDidLayout && IsNewArchitecture) {
                    fixGaps();
                }
            }

            if (state.needsOtherAxisSize) {
                const otherAxisSize = horizontal ? sizeObj.height : sizeObj.width;
                const cur = peek$(ctx, "otherAxisSize");
                // console.log("cur", cur, otherAxisSize, sizeObj);
                if (!cur || otherAxisSize > cur) {
                    set$(ctx, "otherAxisSize", otherAxisSize);
                }
            }
        },
        [],
    );

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

        doMaintainScrollAtEnd(false);
        updateAlignItemsPaddingTop();
        checkAtBottom();
        checkAtTop();

        if (didChange) {
            calculateItemsInView();
        }
        if (didChange || otherAxisSize !== prevOtherAxisSize) {
            set$(ctx, "scrollSize", { width: size.width, height: size.height });
        }

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
    }, []);

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        const layout = event.nativeEvent.layout;
        handleLayout(layout);

        const scrollLength = layout[horizontal ? "width" : "height"];
        const otherAxisSize = layout[horizontal ? "height" : "width"];

        if (onLayoutProp) {
            onLayoutProp(event);
        }
    }, []);

    if (IsNewArchitecture) {
        useLayoutEffect(() => {
            // unstable_getBoundingClientRect is unstable and only on Fabric
            const measured: { width: number; height: number } = (
                refScroller.current as any
            )?.unstable_getBoundingClientRect?.();
            if (measured) {
                const size = Math.floor(measured[horizontal ? "width" : "height"] * 8) / 8;

                if (size) {
                    handleLayout(measured);
                }
            }
        }, []);
    }

    const handleScroll = useCallback(
        (event: {
            nativeEvent: NativeScrollEvent;
        }) => {
            if (event.nativeEvent?.contentSize?.height === 0 && event.nativeEvent.contentSize?.width === 0) {
                return;
            }
            const state = refState.current!;
            const newScroll = event.nativeEvent.contentOffset[horizontal ? "x" : "y"];
            state.scrollPending = newScroll;
            if (state.ignoreScrollFromCalcTotal && newScroll !== 0) {
                // Ignore scroll from calcTotal unless it's scrolling to 0
                return;
            }

            updateScroll(newScroll);

            state.onScroll?.(event as NativeSyntheticEvent<NativeScrollEvent>);
        },
        [],
    );

    const updateScroll = useCallback((newScroll: number) => {
        const state = refState.current!;
        const scrollingTo = state.scrollingTo;

        if (scrollingTo !== undefined && Math.abs(newScroll - scrollingTo.offset) < 10) {
            finishScrollTo();
        }

        if (state.disableScrollJumpsFrom !== undefined) {
            // If the scroll is too far from the disableScrollJumpsFrom position, don't update the scroll position
            // This is to prevent jumpiness when adding items to the top of the list
            const scrollMinusAdjust = newScroll - state.scrollAdjustHandler.getAppliedAdjust();
            if (Math.abs(scrollMinusAdjust - state.disableScrollJumpsFrom) > 200) {
                return;
            }

            // If it's close enough, we're past the jumpiness period so reset the disableScrollJumpsFrom position
            state.disableScrollJumpsFrom = undefined;
        }

        state.hasScrolled = true;
        state.lastBatchingAction = Date.now();
        const currentTime = performance.now();

        // Don't add to the history if it's initial scroll event otherwise invalid velocity will be calculated
        // Don't add to the history if we are scrolling to an offset
        if (scrollingTo === undefined && !(state.scrollHistory.length === 0 && newScroll === initialContentOffset)) {
            // Update scroll history
            state.scrollHistory.push({ scroll: newScroll, time: currentTime });
        }

        // Keep only last 5 entries
        if (state.scrollHistory.length > 5) {
            state.scrollHistory.shift();
        }

        if (state.scrollTimer !== undefined) {
            clearTimeout(state.scrollTimer);
        }

        state.scrollTimer = setTimeout(() => {
            state.scrollVelocity = 0;
        }, 500);

        // Calculate average velocity from history
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

        // Update current scroll state
        state.scrollPrev = state.scroll;
        state.scrollPrevTime = state.scrollTime;
        state.scroll = newScroll;
        state.scrollTime = currentTime;
        state.scrollVelocity = velocity;
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
                        scrollToIndex({ index, viewOffset: -paddingBottom - footerSize, ...options });
                    }
                },
            };
        },
        [],
    );

    if (Platform.OS === "web") {
        useEffect(() => {
            if (initialContentOffset) {
                refState.current?.scrollAdjustHandler.setDisableAdjust(true);
                scrollTo({ offset: initialContentOffset, animated: false });

                setTimeout(() => {
                    refState.current?.scrollAdjustHandler.setDisableAdjust(false);
                }, 0);
            }
        }, []);
    }

    return (
        <>
            <ListComponent
                {...rest}
                horizontal={horizontal!}
                refScrollView={combinedRef}
                initialContentOffset={initialContentOffset}
                getRenderedItem={getRenderedItem}
                updateItemSize={updateItemSize}
                handleScroll={handleScroll}
                onMomentumScrollEnd={(event) => {
                    const scrollingTo = refState.current?.scrollingTo;
                    if (scrollingTo !== undefined) {
                        // If we are scrolling to an offset, its position may have changed during the scroll
                        // if the actual sizes are different from the estimated sizes
                        // So do another scroll to the same offset to make sure it's in the correct position

                        // Android doesn't scroll correctly if called in onMomentumScrollEnd
                        // so do the scroll in a requestAnimationFrame
                        requestAnimationFrame(() => {
                            scrollTo({ ...scrollingTo, animated: false });
                            refState.current!.scrollingTo = undefined;
                            requestAnimationFrame(() => {
                                refState.current!.scrollAdjustHandler.setDisableAdjust(false);
                            });
                        });
                    }

                    const wasPaused = refState.current!.scrollAdjustHandler.unPauseAdjust();
                    if (wasPaused) {
                        refState.current!.scrollVelocity = 0;
                        refState.current!.scrollHistory = [];
                        calculateItemsInView();
                    }
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
            />
            {__DEV__ && ENABLE_DEBUG_VIEW && <DebugView state={refState.current!} />}
        </>
    );
});
