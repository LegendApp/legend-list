// biome-ignore lint/style/useImportType: Some uses crash if importing React is missing
import * as React from "react";
import { type ForwardedRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import {
    Dimensions,
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    Platform,
    RefreshControl,
    type ScrollView,
    StyleSheet,
} from "react-native";
import {
    useRecyclingEffect as useRecyclingEffectHook,
    useRecyclingState as useRecyclingStateHook,
    useViewabilityAmount as useViewabilityAmountHook,
    useViewability as useViewabilityHook,
} from "./ContextContainer";
import { DebugView } from "./DebugView";
import { ListComponent } from "./ListComponent";
import { ScrollAdjustHandler } from "./ScrollAdjustHandler";
import { ANCHORED_POSITION_OUT_OF_VIEW, ENABLE_DEBUG_VIEW, POSITION_OUT_OF_VIEW } from "./constants";
import { StateProvider, getContentSize, peek$, set$, useStateContext } from "./state";
import type {
    AnchoredPosition,
    InternalState,
    LegendListProps,
    LegendListRecyclingState,
    LegendListRef,
    ViewabilityAmountCallback,
    ViewabilityCallback,
} from "./types";
import { typedForwardRef } from "./types";
import { useCombinedRef } from "./useCombinedRef";
import { useInit } from "./useInit";
import { setupViewability, updateViewableItems } from "./viewability";

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
        data: dataProp,
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
        estimatedItemSize,
        getEstimatedItemSize,
        ListEmptyComponent,
        onItemSizeChanged,
        scrollEventThrottle,
        refScrollView,
        waitForInitialLayout = true,
        extraData,
        onLayout: onLayoutProp,
        onRefresh,
        refreshing,
        progressViewOffset,
        refreshControl,
        initialContainerPoolRatio = 2,
        ...rest
    } = props;
    const { style, contentContainerStyle } = props;

    const callbacks = useRef({
        onStartReached: rest.onStartReached,
        onEndReached: rest.onEndReached,
    });

    // ensure that the callbacks are updated
    callbacks.current.onStartReached = rest.onStartReached;
    callbacks.current.onEndReached = rest.onEndReached;

    const ctx = useStateContext();
    ctx.columnWrapperStyle = columnWrapperStyle;

    const refScroller = useRef<ScrollView>(null) as React.MutableRefObject<ScrollView>;
    const combinedRef = useCombinedRef(refScroller, refScrollView);
    const scrollBuffer = drawDistance ?? DEFAULT_DRAW_DISTANCE;
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

    const getItemSize = (key: string, index: number, data: T) => {
        const sizeKnown = refState.current!.sizes.get(key)!;
        if (sizeKnown !== undefined) {
            return sizeKnown;
        }

        const size =
            (getEstimatedItemSize ? getEstimatedItemSize(index, data) : estimatedItemSize) ?? DEFAULT_ITEM_SIZE;
        // TODO: I don't think I like this setting sizes when it's not really known, how to do
        // that better and support viewability checking sizes
        refState.current!.sizes.set(key, size);
        return size;
    };
    const calculateOffsetForIndex = (index = initialScrollIndex) => {
        // This function is called before refState is initialized, so we need to use dataProp
        const data = dataProp;
        if (index) {
            let offset = 0;
            const canGetSize = !!refState.current;
            if (canGetSize || getEstimatedItemSize) {
                const sizeFn = (index: number) => {
                    if (canGetSize) {
                        return getItemSize(getId(index), index, data[index]);
                    }
                    return getEstimatedItemSize!(index, data[index]);
                };
                for (let i = 0; i < index; i++) {
                    offset += sizeFn(i);
                }
            } else if (estimatedItemSize) {
                offset = index * estimatedItemSize;
            }

            return offset / numColumnsProp;
        }
        return 0;
    };

    const initialContentOffset = initialScrollOffset ?? useMemo(calculateOffsetForIndex, []);

    if (!refState.current) {
        const initialScrollLength = Dimensions.get("window")[horizontal ? "width" : "height"];
        refState.current = {
            sizes: new Map(),
            positions: new Map(),
            columns: new Map(),
            pendingAdjust: 0,
            isStartReached: initialContentOffset < initialScrollLength * onStartReachedThreshold!,
            isEndReached: false,
            isAtBottom: false,
            isAtTop: false,
            data: dataProp,
            scrollLength: initialScrollLength,
            startBuffered: 0,
            startNoBuffer: 0,
            endBuffered: 0,
            endNoBuffer: 0,
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
            indexByKey: new Map(),
            scrollHistory: [],
            scrollVelocity: 0,
            sizesLaidOut: __DEV__ ? new Map() : undefined,
            timeoutSizeMessage: 0,
            scrollTimer: undefined,
            belowAnchorElementPositions: undefined,
            rowHeights: new Map(),
            startReachedBlockedByTimer: false,
            endReachedBlockedByTimer: false,
            scrollForNextCalculateItemsInView: undefined,
            enableScrollForNextCalculateItemsInView: true,
            minIndexSizeChanged: 0,
            numPendingInitialLayout: 0,
            queuedCalculateItemsInView: 0,
            lastBatchingAction: Date.now(),
            onScroll: onScrollProp,
        };

        if (maintainVisibleContentPosition) {
            if (initialScrollIndex) {
                refState.current!.anchorElement = {
                    coordinate: initialContentOffset,
                    id: getId(initialScrollIndex),
                };
            } else if (dataProp.length) {
                refState.current!.anchorElement = {
                    coordinate: initialContentOffset,
                    id: getId(0),
                };
            } else {
                console.warn("[legend-list] maintainVisibleContentPosition was not able to find an anchor element");
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
                refState.current!.scrollAdjustHandler.requestAdjust(applyAdjustValue, (diff: number) => {
                    // event state.scroll will contain invalid value, until next handleScroll
                    // apply adjustment
                    state.scroll -= diff;
                });
            }
        }

        set$(ctx, "totalSize", state.totalSize);
        set$(ctx, "totalSizeWithScrollAdjust", resultSize);

        if (alignItemsAtEnd) {
            doUpdatePaddingTop();
        }
    }, []);

    const getRowHeight = (n: number): number => {
        const { rowHeights, data } = refState.current!;
        const numColumns = peek$<number>(ctx, "numColumns");
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

    // this function rebuilds it's data on each addTotalSize
    // this can be further optimized either by rebuilding part that's changed or by moving achorElement up, keeping number of function iterations minimal
    const buildElementPositionsBelowAnchor = (): Map<string, number> => {
        const state = refState.current!;

        if (!state.anchorElement) {
            return new Map();
        }
        let top = state.anchorElement!.coordinate;
        const anchorIndex = state.indexByKey.get(state.anchorElement.id)!;
        if (anchorIndex === 0) {
            return new Map();
        }
        const map = state.belowAnchorElementPositions || new Map();
        const numColumns = peek$<number>(ctx, "numColumns");

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

    const getElementPositionBelowAchor = (id: string) => {
        const state = refState.current!;
        if (!refState.current!.belowAnchorElementPositions) {
            state.belowAnchorElementPositions = buildElementPositionsBelowAnchor();
        }
        const res = state.belowAnchorElementPositions!.get(id);

        if (res === undefined) {
            console.warn(`Undefined position below achor ${id} ${state.anchorElement?.id}`);
            return 0;
        }
        return res;
    };

    const calculateItemsInView = useCallback(() => {
        const state = refState.current!;
        const {
            data,
            scrollLength,
            scroll: scrollState,
            startBufferedId: startBufferedIdOrig,
            positions,
            columns,
            scrollAdjustHandler,
            scrollVelocity: speed,
        } = state!;
        if (!data || scrollLength === 0) {
            return;
        }

        const topPad = (peek$<number>(ctx, "stylePaddingTop") || 0) + (peek$<number>(ctx, "headerSize") || 0);
        const numColumns = peek$<number>(ctx, "numColumns");
        const previousScrollAdjust = scrollAdjustHandler.getAppliedAdjust();
        const scrollExtra = Math.max(-16, Math.min(16, speed)) * 16;
        const scroll = scrollState - previousScrollAdjust - topPad;

        if (ENABLE_DEBUG_VIEW) {
            set$(ctx, "debugRawScroll", scrollState);
            set$(ctx, "debugComputedScroll", scroll);
        }

        let scrollBufferTop = scrollBuffer;
        let scrollBufferBottom = scrollBuffer;

        if (scrollExtra > 8) {
            scrollBufferTop = 0;
            scrollBufferBottom = scrollBuffer + scrollExtra;
        }
        if (scrollExtra < -8) {
            scrollBufferTop = scrollBuffer - scrollExtra;
            scrollBufferBottom = 0;
        }

        //console.log(scrollExtra,scrollBufferTop,scrollBufferBottom)

        // Check precomputed scroll range to see if we can skip this check
        if (state.scrollForNextCalculateItemsInView) {
            const { top, bottom } = state.scrollForNextCalculateItemsInView;
            if (scroll > top && scroll < bottom) {
                return;
            }
        }

        const scrollBottom = scroll + scrollLength;

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
                const size = getItemSize(id, i, data[i]);
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

        // scan data forwards
        for (let i = loopStart; i < data!.length; i++) {
            const id = getId(i)!;
            const size = getItemSize(id, i, data[i]);

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

            if (startNoBuffer === null && top + size > scroll) {
                startNoBuffer = i;
            }
            if (startBuffered === null && top + size > scroll - scrollBufferTop) {
                startBuffered = i;
                startBufferedId = id;
            }
            if (startNoBuffer !== null) {
                if (top <= scrollBottom) {
                    endNoBuffer = i;
                }
                if (top <= scrollBottom + scrollBufferBottom) {
                    endBuffered = i;
                } else {
                    break;
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
        const nextTop = Math.ceil(startBuffered !== null ? positions.get(startBufferedId!)! + scrollBuffer : 0);
        const nextBottom = Math.floor(
            endBuffered !== null ? (positions.get(getId(endBuffered! + 1))! || 0) - scrollLength - scrollBuffer : 0,
        );
        if (state.enableScrollForNextCalculateItemsInView) {
            state.scrollForNextCalculateItemsInView =
                nextTop >= 0 && nextBottom >= 0
                    ? {
                          top: nextTop,
                          bottom: nextBottom,
                      }
                    : undefined;
        }

        // console.log("start", startBuffered, startNoBuffer, endNoBuffer, endBuffered, startBufferedId);

        if (startBuffered !== null && endBuffered !== null) {
            const prevNumContainers = ctx.values.get("numContainers") as number;
            let numContainers = prevNumContainers;
            let didWarnMoreContainers = false;
            for (let i = startBuffered; i <= endBuffered; i++) {
                let isContained = false;
                const id = getId(i)!;
                // See if this item is already in a container
                for (let j = 0; j < numContainers; j++) {
                    const key = peek$(ctx, `containerItemKey${j}`);
                    if (key === id) {
                        isContained = true;
                        break;
                    }
                }
                // If it's not in a container, then we need to recycle a container out of view
                if (!isContained) {
                    const top = positions.get(id) || 0;
                    let furthestIndex = -1;
                    let furthestDistance = 0;
                    // Find the furthest container so we can recycle a container from the other side of scroll
                    // to reduce empty container flashing when switching directions
                    // Note that since this is only checking top it may not be 100% accurate but that's fine.

                    for (let u = 0; u < numContainers; u++) {
                        const key = peek$<string>(ctx, `containerItemKey${u}`);
                        // Hasn't been allocated yet, just use it
                        if (key === undefined) {
                            furthestIndex = u;
                            break;
                        }

                        const index = state.indexByKey.get(key)!;
                        const pos = peek$<AnchoredPosition>(ctx, `containerPosition${u}`).top;

                        if (index < startBuffered || index > endBuffered) {
                            const distance = Math.abs(pos - top);
                            if (index < 0 || distance > furthestDistance) {
                                furthestDistance = distance;
                                furthestIndex = u;
                            }
                        }
                    }
                    if (furthestIndex >= 0) {
                        set$(ctx, `containerItemKey${furthestIndex}`, id);
                        const index = state.indexByKey.get(id)!;
                        set$(ctx, `containerItemData${furthestIndex}`, data[index]);
                    } else {
                        const containerId = numContainers;

                        numContainers++;
                        set$(ctx, `containerItemKey${containerId}`, id);
                        const index = state.indexByKey.get(id)!;
                        set$(ctx, `containerItemData${containerId}`, data[index]);

                        // TODO: This may not be necessary as it'll get a new one in the next loop?
                        set$(ctx, `containerPosition${containerId}`, ANCHORED_POSITION_OUT_OF_VIEW);
                        set$(ctx, `containerColumn${containerId}`, -1);

                        if (
                            __DEV__ &&
                            !didWarnMoreContainers &&
                            numContainers > peek$<number>(ctx, "numContainersPooled")
                        ) {
                            didWarnMoreContainers = true;
                            console.warn(
                                "[legend-list] No container to recycle, so creating one on demand. This can be a minor performance issue and is likely caused by the estimatedItemSize being too large. Consider decreasing estimatedItemSize. numContainers:",
                                numContainers,
                            );
                        }
                    }
                }
            }

            if (numContainers !== prevNumContainers) {
                set$(ctx, "numContainers", numContainers);
                if (numContainers > peek$<number>(ctx, "numContainersPooled")) {
                    set$(ctx, "numContainersPooled", Math.ceil(numContainers * 1.5));
                }
            }

            // Update top positions of all containers
            // TODO: This could be optimized to only update the containers that have changed
            // but it likely would have little impact. Remove this comment if not worth doing.
            for (let i = 0; i < numContainers; i++) {
                const itemKey = peek$<string>(ctx, `containerItemKey${i}`);
                const itemIndex = state.indexByKey.get(itemKey)!;
                const item = data[itemIndex];
                if (item !== undefined) {
                    const id = getId(itemIndex);
                    if (itemKey !== id || itemIndex < startBuffered || itemIndex > endBuffered) {
                        // This is fairly complex because we want to avoid setting container position if it's not even in view
                        // because it will trigger a render
                        const prevPos = peek$<AnchoredPosition>(ctx, `containerPosition${i}`).top;
                        const pos = positions.get(id) || 0;
                        const size = getItemSize(id, itemIndex, data[i]);

                        if (
                            (pos + size >= scroll && pos <= scrollBottom) ||
                            (prevPos + size >= scroll && prevPos <= scrollBottom)
                        ) {
                            set$(ctx, `containerPosition${i}`, ANCHORED_POSITION_OUT_OF_VIEW);
                        }
                    } else {
                        const pos: AnchoredPosition = {
                            type: "top",
                            relativeCoordinate: positions.get(id) || 0,
                            top: positions.get(id) || 0,
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

                        const prevPos = peek$<AnchoredPosition>(ctx, `containerPosition${i}`);
                        const prevColumn = peek$(ctx, `containerColumn${i}`);
                        const prevData = peek$(ctx, `containerItemData${i}`);

                        if (pos.relativeCoordinate > POSITION_OUT_OF_VIEW && pos.top !== prevPos.top) {
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

        // If it's 0 then we're waiting for the initial layout to complete
        if (state.numPendingInitialLayout === 0) {
            state.numPendingInitialLayout = state.endBuffered - state.startBuffered + 1;
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

    const doUpdatePaddingTop = () => {
        if (alignItemsAtEnd) {
            const { scrollLength } = refState.current!;
            const contentSize = getContentSize(ctx);
            const paddingTop = Math.max(0, Math.floor(scrollLength - contentSize));
            set$(ctx, "paddingTop", paddingTop);
        }
    };

    const doMaintainScrollAtEnd = (animated: boolean) => {
        const state = refState.current;
        if (state?.isAtBottom && maintainScrollAtEnd) {
            // TODO: This kinda works, but with a flash. Since setNativeProps is less ideal we'll favor the animated one for now.
            // scrollRef.current?.setNativeProps({
            //   contentContainerStyle: {
            //     height:
            //       visibleRange$.totalSize.get() + visibleRange$.topPad.get() + 48,
            //   },
            //   contentOffset: {
            //     y:
            //       visibleRange$.totalSize.peek() +
            //       visibleRange$.topPad.peek() -
            //       SCREEN_LENGTH +
            //       48 * 3,
            //   },
            // });

            // Set scroll to the bottom of the list so that checkAtTop/checkAtBottom is correct
            const paddingTop = peek$<number>(ctx, "paddingTop") || 0;
            if (paddingTop > 0) {
                // if paddingTop exists, list is shorter then a screen, so scroll should be 0 anyways
                state.scroll = 0;
            }

            // TODO: This kinda works too, but with more of a flash
            requestAnimationFrame(() => {
                refScroller.current?.scrollToEnd({
                    animated,
                });
            });

            return true;
        }
    };

    const checkThreshold = (
        distance: number,
        threshold: number,
        isReached: boolean,
        isBlockedByTimer: boolean,
        onReached?: (distance: number) => void,
        blockTimer?: (block: boolean) => void,
    ) => {
        const distanceAbs = Math.abs(distance);
        const isAtThreshold = distanceAbs < threshold;

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
        const { scrollLength, scroll, hasScrolled } = refState.current;
        const contentSize = getContentSize(ctx);
        if (contentSize > 0 && hasScrolled) {
            // Check if at end
            const distanceFromEnd = contentSize - scroll - scrollLength;
            const distanceFromEndAbs = Math.abs(distanceFromEnd);
            refState.current.isAtBottom = distanceFromEndAbs < scrollLength * maintainScrollAtEndThreshold;

            refState.current.isEndReached = checkThreshold(
                distanceFromEnd,
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
        const distanceFromTopAbs = Math.abs(distanceFromTop);
        refState.current.isAtTop = distanceFromTopAbs < 0;

        refState.current.isStartReached = checkThreshold(
            distanceFromTop,
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
                refState.current!.scrollForNextCalculateItemsInView = undefined;

                // Reset containers that aren't used anymore because the data has changed
                const numContainers = peek$<number>(ctx, "numContainers");
                for (let i = 0; i < numContainers; i++) {
                    const itemKey = peek$<string>(ctx, `containerItemKey${i}`);
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

                calculateItemsInView();

                const didMaintainScrollAtEnd = doMaintainScrollAtEnd(false);

                // Reset the endReached flag if new data has been added and we didn't
                // just maintain the scroll at end
                if (!didMaintainScrollAtEnd && dataProp.length > state.data.length) {
                    state.isEndReached = false;
                }
                checkAtTop();
                checkAtBottom();
            }
        }
    };

    const calcTotalSizesAndPositions = ({ forgetPositions = false }) => {
        let totalSize = 0;
        let totalSizeBelowIndex = 0;
        const indexByKey = new Map();
        const newPositions = new Map();
        let column = 1;
        let maxSizeInRow = 0;
        const numColumns = peek$<number>(ctx, "numColumns") ?? numColumnsProp;

        if (!refState.current) {
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
            if (
                !forgetPositions &&
                refState.current.positions.get(key) != null &&
                refState.current.indexByKey.get(key) === i
            ) {
                newPositions.set(key, refState.current.positions.get(key)!);
            }
        }
        // getAnchorElementIndex needs indexByKey, build it first
        refState.current.indexByKey = indexByKey;
        refState.current.positions = newPositions;

        if (!forgetPositions && !isFirst) {
            // check if anchorElement is still in the list
            if (maintainVisibleContentPosition) {
                if (
                    refState.current.anchorElement == null ||
                    indexByKey.get(refState.current.anchorElement.id) == null
                ) {
                    if (dataProp.length) {
                        const newAnchorElement = {
                            coordinate: 0,
                            id: getId(0),
                        };
                        refState.current.anchorElement = newAnchorElement;
                        refState.current.belowAnchorElementPositions?.clear();
                        // reset scroll to 0 and schedule rerender
                        refScroller.current?.scrollTo({ x: 0, y: 0, animated: false });
                        setTimeout(() => {
                            calculateItemsInView();
                        }, 0);
                    } else {
                        refState.current.startBufferedId = undefined;
                    }
                }
            } else {
                // if maintainVisibleContentPosition not used, reset startBufferedId if it's not in the list
                if (
                    refState.current.startBufferedId != null &&
                    newPositions.get(refState.current.startBufferedId) == null
                ) {
                    if (dataProp.length) {
                        refState.current.startBufferedId = getId(0);
                    } else {
                        refState.current.startBufferedId = undefined;
                    }
                    // reset scroll to 0 and schedule rerender
                    refScroller.current?.scrollTo({ x: 0, y: 0, animated: false });
                    setTimeout(() => {
                        calculateItemsInView();
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

        // If have any height leftover from a row that doesn't extend through the last column
        // add it to total size
        if (maxSizeInRow > 0) {
            totalSize += maxSizeInRow;
        }
        const state = refState.current;
        state.ignoreScrollFromCalcTotal = true;
        requestAnimationFrame(() => {
            state.ignoreScrollFromCalcTotal = false;
        });
        addTotalSize(null, totalSize, totalSizeBelowIndex);
    };

    const isFirst = !refState.current.renderItem;

    const memoizedLastItemKeys = useMemo(() => {
        if (!dataProp.length) return new Set();
        return new Set(
            Array.from({ length: Math.min(numColumnsProp, dataProp.length) }, (_, i) => getId(dataProp.length - 1 - i)),
        );
    }, [dataProp.length, numColumnsProp, dataProp.slice(-numColumnsProp).toString()]);

    // Run first time and whenever data changes
    const initalizeStateVars = () => {
        set$(ctx, "lastItemKeys", memoizedLastItemKeys);
        set$(ctx, "numColumns", numColumnsProp);
        set$(ctx, "stylePaddingTop", stylePaddingTop);
    };
    if (isFirst) {
        initalizeStateVars();
    }
    if (isFirst || didDataChange || numColumnsProp !== peek$<number>(ctx, "numColumns")) {
        refState.current.lastBatchingAction = Date.now();
        if (!keyExtractorProp && !isFirst && didDataChange) {
            // If we have no keyExtractor then we have no guarantees about previous item sizes so we have to reset
            refState.current.sizes.clear();
            refState.current.positions.clear();
        }

        calcTotalSizesAndPositions({ forgetPositions: false });
    }

    useEffect(() => {
        const didAllocateContainers = doInitialAllocateContainers();
        if (!didAllocateContainers) {
            checkResetContainers(/*isFirst*/ isFirst);
        }
    }, [isFirst, dataProp, numColumnsProp]);

    useEffect(() => {
        set$(ctx, "extraData", extraData);
    }, [extraData]);

    refState.current.renderItem = renderItem!;

    // TODO: This needs to support horizontal and other ways of defining padding
    const stylePaddingTop =
        StyleSheet.flatten(style)?.paddingTop ?? StyleSheet.flatten(contentContainerStyle)?.paddingTop ?? 0;

    useEffect(initalizeStateVars, [memoizedLastItemKeys, numColumnsProp, stylePaddingTop]);

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

        // TODO1.0: Remove these before 1.0, make sure docs have them as separate imports
        const useViewability = (configId: string, callback: ViewabilityCallback) => {
            useViewabilityHook(configId, callback);
        };
        const useViewabilityAmount = (callback: ViewabilityAmountCallback) => {
            useViewabilityAmountHook(callback);
        };
        const useRecyclingEffect = (effect: (info: LegendListRecyclingState<unknown>) => void | (() => void)) => {
            useRecyclingEffectHook(effect);
        };
        const useRecyclingState = (valueOrFun: ((info: LegendListRecyclingState<unknown>) => any) | any) => {
            return useRecyclingStateHook(valueOrFun);
        };

        const renderedItem = refState.current!.renderItem?.({
            item: data[index],
            index,
            extraData: peek$(ctx, "extraData"),
            useViewability,
            useViewabilityAmount,
            useRecyclingEffect,
            useRecyclingState,
        });

        return { index, item: data[index], renderedItem };
    }, []);

    const doInitialAllocateContainers = () => {
        const state = refState.current!;

        // Allocate containers
        const { scrollLength, data } = state;
        if (scrollLength > 0 && data.length > 0 && !peek$(ctx, "numContainers")) {
            const averageItemSize = estimatedItemSize ?? getEstimatedItemSize?.(0, data[0]) ?? DEFAULT_ITEM_SIZE;
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
                    calculateItemsInView();
                });
            } else {
                calculateItemsInView();
            }

            return true;
        }
    };

    useInit(() => {
        const state = refState.current!;
        const viewability = setupViewability(props);
        state.viewabilityConfigCallbackPairs = viewability;
        state.enableScrollForNextCalculateItemsInView = !viewability;

        doInitialAllocateContainers();
    });

    const updateItemSize = useCallback((itemKey: string, size: number) => {
        const state = refState.current!;
        const { sizes, indexByKey, sizesLaidOut, data, rowHeights } = state;
        if (!data) {
            return;
        }
        const index = indexByKey.get(itemKey)!;
        const numColumns = peek$<number>(ctx, "numColumns");

        state.minIndexSizeChanged =
            state.minIndexSizeChanged !== undefined ? Math.min(state.minIndexSizeChanged, index) : index;

        const prevSize = getItemSize(itemKey, index, data as any);

        let needsCalculate = false;
        let needsUpdateContainersDidLayout = false;

        if (state.numPendingInitialLayout > 0) {
            state.numPendingInitialLayout--;
            if (state.numPendingInitialLayout === 0) {
                needsCalculate = true;
                // Set to -1 to indicate that the initial layout has been completed
                state.numPendingInitialLayout = -1;
                needsUpdateContainersDidLayout = true;
            }
        }

        if (!prevSize || Math.abs(prevSize - size) > 0.5) {
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

            if (__DEV__ && !estimatedItemSize && !getEstimatedItemSize) {
                sizesLaidOut!.set(itemKey, size);
                if (state.timeoutSizeMessage) {
                    clearTimeout(state.timeoutSizeMessage);
                }

                state.timeoutSizeMessage = setTimeout(() => {
                    state.timeoutSizeMessage = undefined;
                    let total = 0;
                    let num = 0;
                    for (const [key, size] of sizesLaidOut!) {
                        num++;
                        total += size;
                    }
                    const avg = Math.round(total / num);

                    console.warn(
                        `[legend-list] estimatedItemSize or getEstimatedItemSize are not defined. Based on the ${num} items rendered so far, the optimal estimated size is ${avg}.`,
                    );
                }, 1000);
            }

            // Reset scrollForNextCalculateItemsInView because a position may have changed making the previous
            // precomputed scroll range invalid
            refState.current!.scrollForNextCalculateItemsInView = undefined;

            addTotalSize(itemKey, diff, 0);

            doMaintainScrollAtEnd(true);

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

        if (needsCalculate) {
            // TODO: Could this be optimized to only calculate items in view that have changed?
            const scrollVelocity = state.scrollVelocity;
            // Calculate positions if not currently scrolling and not waiting on other items to layout
            if (
                (Number.isNaN(scrollVelocity) || Math.abs(scrollVelocity) < 1) &&
                (!waitForInitialLayout || state.numPendingInitialLayout < 0)
            ) {
                const setDidLayout = () => {
                    set$(ctx, "containersDidLayout", true);
                    if (Platform.OS === "web") {
                        // On web we need to wait until after the hack where containers have a useEffect
                        // to catch not resizing which updates size in a timeout of 16ms
                        setTimeout(() => {
                            state.scrollAdjustHandler.setDisableAdjust(false);
                        }, 32);
                    }
                };
                if (Date.now() - state.lastBatchingAction < 500) {
                    // If this item layout is within 500ms of the most recent list layout, scroll, or column change,
                    // batch calculations from layout to reduce the number of computations and renders.
                    // This heuristic is basically to determine whether this comes from an internal List action or an external component action.
                    // Batching adds a slight delay so this ensures that calculation is batched only if
                    // it's likely that multiple items will have changed size and a one frame delay is acceptable,
                    // such as when items are changed, the list changed size, or during scrolling.
                    state.queuedCalculateItemsInView = requestAnimationFrame(() => {
                        state.queuedCalculateItemsInView = undefined;
                        calculateItemsInView();
                        if (needsUpdateContainersDidLayout) {
                            setDidLayout();
                        }
                    });
                } else {
                    // Otherwise this action is likely from a single item changing so it should run immediately
                    calculateItemsInView();
                    if (needsUpdateContainersDidLayout) {
                        // Needs to be in a microtask because we can't set animated values from onLayout
                        queueMicrotask(setDidLayout);
                    }
                }
            }
        }
    }, []);

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        const state = refState.current!;
        const scrollLength = event.nativeEvent.layout[horizontal ? "width" : "height"];
        const didChange = scrollLength !== state.scrollLength;
        state.scrollLength = scrollLength;
        state.lastBatchingAction = Date.now();
        state.scrollForNextCalculateItemsInView = undefined;

        doInitialAllocateContainers();

        doMaintainScrollAtEnd(false);
        doUpdatePaddingTop();
        checkAtBottom();
        checkAtTop();

        if (didChange) {
            calculateItemsInView();
        }

        if (__DEV__) {
            const isWidthZero = event.nativeEvent.layout.width === 0;
            const isHeightZero = event.nativeEvent.layout.height === 0;
            if (isWidthZero || isHeightZero) {
                console.warn(
                    `[legend-list] List ${
                        isWidthZero ? "width" : "height"
                    } is 0. You may need to set a style or \`flex: \` for the list, because children are absolutely positioned.`,
                );
            }
        }
        if (onLayoutProp) {
            onLayoutProp(event);
        }
    }, []);

    const handleScroll = useCallback(
        (
            event: {
                nativeEvent: NativeScrollEvent;
            },
            fromSelf?: boolean,
        ) => {
            if (event.nativeEvent?.contentSize?.height === 0 && event.nativeEvent.contentSize?.width === 0) {
                return;
            }

            const state = refState.current!;
            const newScroll = event.nativeEvent.contentOffset[horizontal ? "x" : "y"];
            // Ignore scroll from calcTotal unless it's scrolling to 0
            if (state.ignoreScrollFromCalcTotal && newScroll !== 0) {
                return;
            }

            state.hasScrolled = true;
            state.lastBatchingAction = Date.now();
            const currentTime = performance.now();

            // don't add to the history, if it's initial scroll event
            // otherwise invalid velocity will be calculated
            if (!(state.scrollHistory.length === 0 && newScroll === initialContentOffset)) {
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
                const oldest = state.scrollHistory[0];
                const scrollDiff = newest.scroll - oldest.scroll;
                const timeDiff = newest.time - oldest.time;
                velocity = timeDiff > 0 ? scrollDiff / timeDiff : 0;
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

            if (!fromSelf) {
                state.onScroll?.(event as NativeSyntheticEvent<NativeScrollEvent>);
            }
        },
        [],
    );

    useImperativeHandle(
        forwardedRef,
        () => {
            const scrollToIndex = ({
                index,
                viewOffset = 0,
                animated = true,
                viewPosition = 0,
            }: Parameters<LegendListRef["scrollToIndex"]>[0]) => {
                const state = refState.current!;
                const firstIndexOffset = calculateOffsetForIndex(index);
                let firstIndexScrollPostion = firstIndexOffset - viewOffset;
                const diff = Math.abs(state.scroll - firstIndexScrollPostion);

                // TODO: include checking if destination element position is already known, to avoid unneeded anchor element switches
                const needsReanchoring = maintainVisibleContentPosition && diff > 100;
                state.scrollForNextCalculateItemsInView = undefined;

                if (needsReanchoring) {
                    // in the maintainVisibleContentPosition we can choose element we are scrolling to as anchor element
                    // now let's cleanup old positions and set new anchor element
                    const id = getId(index);
                    state.anchorElement = { id, coordinate: firstIndexOffset };
                    state.belowAnchorElementPositions?.clear();
                    state.positions.clear();
                    calcTotalSizesAndPositions({ forgetPositions: true }); // since we are choosing new anchor, we need to recalulate positions
                    state.startBufferedId = id;
                    state.minIndexSizeChanged = index;

                    // when doing scrollTo, it's important to use latest adjust value
                    firstIndexScrollPostion =
                        firstIndexOffset - viewOffset + state.scrollAdjustHandler.getAppliedAdjust();
                }

                // Sometimes after scroll containers are randomly positioned so make sure we are calling calculateItemsInView
                // after scroll is done in both maintainVisibleContentPosition and normal mode
                // And disable scroll adjust while scrolling so that it doesn't do extra work affecting the target offset
                state.scrollAdjustHandler.setDisableAdjust(true);
                setTimeout(
                    () => {
                        state.scrollAdjustHandler.setDisableAdjust(false);
                        calculateItemsInView();
                    },
                    animated ? 150 : 50,
                );

                if (viewPosition) {
                    // TODO: This can be inaccurate if the item size is very different from the estimatedItemSize
                    // In the future we can improve this by listening for the item size change and then updating the scroll position
                    firstIndexScrollPostion -=
                        viewPosition * (state.scrollLength - getItemSize(getId(index), index, state.data[index]));
                }

                const offset = horizontal ? { x: firstIndexScrollPostion, y: 0 } : { x: 0, y: firstIndexScrollPostion };

                // Do the scroll
                refScroller.current!.scrollTo({ ...offset, animated });

                const totalSizeWithScrollAdjust = peek$<number>(ctx, "totalSizeWithScrollAdjust");
                if (
                    maintainVisibleContentPosition &&
                    totalSizeWithScrollAdjust - firstIndexScrollPostion < state.scrollLength
                ) {
                    // This fixes scrollToIndex being inaccurate when the estimatedItemSize is smaller than the actual item size
                    setTimeout(
                        () => {
                            refScroller.current!.scrollTo({ ...offset, animated });
                        },
                        animated ? 150 : 50,
                    );
                }
            };
            return {
                getNativeScrollRef: () => refScroller.current!,
                getScrollableNode: () => refScroller.current!.getScrollableNode(),
                getScrollResponder: () => refScroller.current!.getScrollResponder(),
                flashScrollIndicators: () => refScroller.current!.flashScrollIndicators(),
                scrollToIndex,
                scrollToOffset: ({ offset, animated }) => {
                    const offsetObj = horizontal ? { x: offset, y: 0 } : { x: 0, y: offset };
                    refScroller.current!.scrollTo({ ...offsetObj, animated });
                },
                scrollToItem: ({ item, ...props }) => {
                    const { data } = refState.current!;
                    const index = data.indexOf(item);
                    if (index !== -1) {
                        scrollToIndex({ index, ...props });
                    }
                },
                scrollToEnd: (options) => refScroller.current!.scrollToEnd(options),
            };
        },
        [],
    );

    if (Platform.OS === "web") {
        useEffect(() => {
            if (initialContentOffset) {
                refState.current?.scrollAdjustHandler.setDisableAdjust(true);
                refScroller.current?.scrollTo({
                    x: horizontal ? initialContentOffset : 0,
                    y: horizontal ? 0 : initialContentOffset,
                    animated: false,
                });
            }
        }, []);
    }

    // TODO: This is a hack to ensure that the initial scroll is applied after the initial layout is complete
    // but there may be a better way to do this
    // First disable scroll adjust so that it doesn't do extra work affecting the target offset while scrolling
    refState.current.scrollAdjustHandler.setDisableAdjust(true);
    useEffect(() => {
        // Then re-enable adjusting after the initial mount
        refState.current!.scrollAdjustHandler.setDisableAdjust(false);
        if (initialContentOffset) {
            // If scrolling to the end it may have not made it all the way, so
            // do another animate to make sure
            setTimeout(() => {
                refScroller.current?.scrollTo({
                    x: horizontal ? initialContentOffset : 0,
                    y: horizontal ? 0 : initialContentOffset,
                    animated: false,
                });
                calculateItemsInView();
            }, 32);
        }
    }, []);

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
                maintainVisibleContentPosition={maintainVisibleContentPosition}
                scrollEventThrottle={scrollEventThrottle ?? (Platform.OS === "web" ? 16 : undefined)}
                waitForInitialLayout={waitForInitialLayout}
                refreshControl={
                    refreshControl ??
                    (onRefresh && (
                        <RefreshControl
                            refreshing={!!refreshing}
                            onRefresh={onRefresh}
                            progressViewOffset={progressViewOffset}
                        />
                    ))
                }
                style={style}
            />
            {__DEV__ && ENABLE_DEBUG_VIEW && <DebugView state={refState.current!} />}
        </>
    );
});
