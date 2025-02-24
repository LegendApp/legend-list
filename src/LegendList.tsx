// biome-ignore lint/style/useImportType: Some uses crash if importing React is missing
import * as React from "react";
import {
    type ForwardedRef,
    type ReactElement,
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
} from "react";
import {
    Dimensions,
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    Platform,
    type ScrollView,
    StyleSheet,
} from "react-native";
import {
    useRecyclingEffect as useRecyclingEffectHook,
    useRecyclingState as useRecyclingStateHook,
    useViewabilityAmount as useViewabilityAmountHook,
    useViewability as useViewabilityHook,
} from "./ContextContainer";
import { ListComponent } from "./ListComponent";
import { ScrollAdjustHandler } from "./ScrollAdjustHandler";
import { ANCHORED_POSITION_OUT_OF_VIEW, POSITION_OUT_OF_VIEW } from "./constants";
import { StateProvider, peek$, set$, useStateContext } from "./state";
import type {
    AnchoredPosition,
    LegendListRecyclingState,
    LegendListRef,
    ViewabilityAmountCallback,
    ViewabilityCallback,
} from "./types";
import type { InternalState, LegendListProps } from "./types";
import { useCombinedRef } from "./useCombinedRef";
import { useInit } from "./useInit";
import { setupViewability, updateViewableItems } from "./viewability";

const DEFAULT_DRAW_DISTANCE = 250;
const DEFAULT_ITEM_SIZE = 100;

export const LegendList: <T>(props: LegendListProps<T> & { ref?: ForwardedRef<LegendListRef> }) => ReactElement =
    forwardRef(function LegendList<T>(props: LegendListProps<T>, forwardedRef: ForwardedRef<LegendListRef>) {
        return (
            <StateProvider>
                <LegendListInner {...props} ref={forwardedRef} />
            </StateProvider>
        );
    }) as never;

const LegendListInner: <T>(props: LegendListProps<T> & { ref?: ForwardedRef<LegendListRef> }) => ReactElement =
    forwardRef(function LegendListInner<T>(props: LegendListProps<T>, forwardedRef: ForwardedRef<LegendListRef>) {
        const {
            data,
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
            numColumns: numColumnsProp = 1,
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
        const calculateInitialOffset = (index = initialScrollIndex) => {
            if (index) {
                let offset = 0;
                if (getEstimatedItemSize) {
                    for (let i = 0; i < index; i++) {
                        offset += getEstimatedItemSize(i, data[i]);
                    }
                } else if (estimatedItemSize) {
                    offset = index * estimatedItemSize;
                }

                return offset / numColumnsProp;
            }
            return 0;
        };

        const initialContentOffset = initialScrollOffset ?? useMemo(calculateInitialOffset, []);

        if (!refState.current) {
            const initialScrollLength = Dimensions.get("window")[horizontal ? "width" : "height"];
            refState.current = {
                sizes: new Map(),
                positions: new Map(),
                columns: new Map(),
                pendingAdjust: 0,
                waitingForMicrotask: false,
                isStartReached: initialContentOffset < initialScrollLength * onStartReachedThreshold!,
                isEndReached: false,
                isAtBottom: false,
                isAtTop: false,
                data,
                idsInFirstRender: undefined as never,
                hasScrolled: false,
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
                scrollForNextCalculateItemsInView: undefined,
                enableScrollForNextCalculateItemsInView: true,
                minIndexSizeChanged: 0,
            };
            refState.current!.idsInFirstRender = new Set(data.map((_: unknown, i: number) => getId(i)));
            if (maintainVisibleContentPosition) {
                if (initialScrollIndex) {
                    refState.current!.anchorElement = {
                        coordinate: initialContentOffset,
                        id: getId(initialScrollIndex),
                    };
                } else if (data.length) {
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
            const { scrollLength, indexByKey, anchorElement } = state;
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

            let applyAdjustValue = undefined;

            const totalSize = state.totalSize;
            let resultSize = totalSize;

            if (maintainVisibleContentPosition && totalSize > scrollLength) {
                const newAdjust = anchorElement!.coordinate - state.totalSizeBelowAnchor;
                applyAdjustValue = -newAdjust;
                state.belowAnchorElementPositions = buildElementPositionsBelowAnchor();
                state.rowHeights.clear();

                if (applyAdjustValue !== undefined) {
                    resultSize -= applyAdjustValue;
                    refState.current!.scrollAdjustHandler.requestAdjust(applyAdjustValue, (diff) => {
                        // event state.scroll will contain invalid value, until next handleScroll
                        // apply adjustment
                        state.scroll -= diff;
                    });
                }
            }

            set$(ctx, "totalSize", resultSize);

            if (alignItemsAtEnd) {
                doUpdatePaddingTop();
            }
        }, []);

        const getRowHeight = (n: number): number => {
            const { rowHeights } = refState.current!;
            if (numColumnsProp === 1) {
                const id = getId(n);
                return getItemSize(id, n, data[n]);
            }
            if (rowHeights.has(n)) {
                return rowHeights.get(n) || 0;
            }
            let rowHeight = 0;
            const startEl = n * numColumnsProp;
            for (let i = startEl; i < startEl + numColumnsProp && i < data.length; i++) {
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
            for (let i = anchorIndex - 1; i >= 0; i--) {
                const id = getId(i);
                const rowNumber = Math.floor(i / numColumnsProp);
                if (i % numColumnsProp === 0) {
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
                throw new Error("Undefined position below achor");
            }
            return res;
        };

        const calculateItemsInView = useCallback((speed: number) => {
            const state = refState.current!;
            const {
                data,
                scrollLength,
                scroll: scrollState,
                startBufferedId: startBufferedIdOrig,
                positions,
                columns,
                scrollAdjustHandler,
            } = state!;
            if (state.waitingForMicrotask) {
                state.waitingForMicrotask = false;
            }
            if (!data) {
                return;
            }

            const topPad = (peek$<number>(ctx, "stylePaddingTop") || 0) + (peek$<number>(ctx, "headerSize") || 0);
            const previousScrollAdjust = scrollAdjustHandler.getAppliedAdjust();
            const scrollExtra = Math.max(-16, Math.min(16, speed)) * 16;
            const scroll = scrollState - previousScrollAdjust - topPad;

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

            const numColumns = peek$<number>(ctx, "numColumns");
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
                    topOffset = initialContentOffset || 0;
                }
                return topOffset;
            };

            // scan data forwards
            for (let i = loopStart; i < data!.length; i++) {
                const id = getId(i)!;
                const size = getItemSize(id, i, data[i]);

                maxSizeInRow = Math.max(maxSizeInRow, size);

                if (top === undefined) {
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

                            if (__DEV__ && numContainers > peek$<number>(ctx, "numContainersPooled")) {
                                console.warn(
                                    "[legend-list] No container to recycle, so creating one on demand. This can be a performance issue and is likely caused by the estimatedItemSize being too small. Consider increasing estimatedItemSize. numContainers:",
                                    numContainers,
                                );
                            }
                        }
                    }
                }

                if (numContainers !== prevNumContainers) {
                    set$(ctx, "numContainers", numContainers);
                    if (numContainers > peek$<number>(ctx, "numContainersPooled")) {
                        set$(ctx, "numContainersPooled", numContainers);
                    }
                }

                // Update top positions of all containers
                // TODO: This could be optimized to only update the containers that have changed
                // but it likely would have little impact. Remove this comment if not worth doing.
                for (let i = 0; i < numContainers; i++) {
                    const itemKey = peek$<string>(ctx, `containerItemKey${i}`);
                    const itemIndex = state.indexByKey.get(itemKey)!;
                    const item = data[itemIndex];
                    if (item) {
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
                                const currentRow = Math.floor(itemIndex / numColumnsProp);
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

            set$(ctx, "containersDidLayout", true);

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
                const { scrollLength, totalSize } = refState.current!;
                const listPaddingTop = peek$<number>(ctx, "stylePaddingTop") || 0;
                const paddingTop = Math.max(0, Math.floor(scrollLength - totalSize - listPaddingTop));
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
                state.scroll = state.totalSize - state.scrollLength + peek$<number>(ctx, "paddingTop");

                // TODO: This kinda works too, but with more of a flash
                requestAnimationFrame(() => {
                    refScroller.current?.scrollToEnd({
                        animated,
                    });
                });

                return true;
            }
        };

        const checkAtBottom = () => {
            if (!refState.current) {
                return;
            }
            const { scrollLength, scroll, totalSize } = refState.current;
            if (totalSize > 0) {
                // Check if at end
                const distanceFromEnd = totalSize - scroll - scrollLength;
                if (refState.current) {
                    refState.current.isAtBottom = distanceFromEnd < scrollLength * maintainScrollAtEndThreshold;
                }

                const { onEndReached } = callbacks.current;

                if (onEndReached) {
                    if (!refState.current.isEndReached) {
                        if (distanceFromEnd < onEndReachedThreshold! * scrollLength) {
                            refState.current.isEndReached = true;
                            onEndReached({ distanceFromEnd });
                        }
                    } else {
                        // reset flag when user scrolls back up
                        if (distanceFromEnd >= onEndReachedThreshold! * scrollLength) {
                            refState.current.isEndReached = false;
                        }
                    }
                }
            }
        };

        const checkAtTop = () => {
            if (!refState.current) {
                return;
            }
            const { scrollLength, scroll } = refState.current;
            const distanceFromTop = scroll;
            refState.current.isAtTop = distanceFromTop < 0;

            const { onStartReached } = callbacks.current;

            if (onStartReached) {
                if (!refState.current.isStartReached && !refState.current!.startReachedBlockedByTimer) {
                    if (distanceFromTop < onStartReachedThreshold! * scrollLength) {
                        refState.current.isStartReached = true;
                        onStartReached({ distanceFromStart: scroll });
                        refState.current!.startReachedBlockedByTimer = true;
                        setTimeout(() => {
                            refState.current!.startReachedBlockedByTimer = false;
                        }, 700);
                    }
                } else {
                    // reset flag when user scrolls back down
                    // add hysteresis to avoid multiple onStartReached events triggered
                    if (distanceFromTop >= 1.3 * onStartReachedThreshold! * scrollLength) {
                        refState.current.isStartReached = false;
                    }
                }
            }
        };

        const checkResetContainers = (reset: boolean) => {
            const state = refState.current;
            if (state) {
                state.data = data;

                if (reset) {
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

                    calculateItemsInView(state!.scrollVelocity);
                }

                const didMaintainScrollAtEnd = doMaintainScrollAtEnd(false);

                // Reset the endReached flag if new data has been added and we didn't
                // just maintain the scroll at end
                if (!didMaintainScrollAtEnd && data.length > state.data.length) {
                    state.isEndReached = false;
                }
                checkAtTop();
                checkAtBottom();
            }
        };

        const isFirst = !refState.current.renderItem;
        // Run first time and whenever data changes
        if (isFirst || data !== refState.current.data || numColumnsProp !== peek$<number>(ctx, "numColumns")) {
            if (!keyExtractorProp && !isFirst && data !== refState.current.data) {
                // If we have no keyExtractor then we have no guarantees about previous item sizes so we have to reset.
                // Note: don't want to clear sizes because if sizes don't change they won't update from onLayout
                // so it's safer to fallback to previous sizes than to the estimate.
                refState.current.positions.clear();
            }

            refState.current.data = data;

            let totalSize = 0;
            let totalSizeBelowIndex = 0;
            const indexByKey = new Map();
            const newPositions = new Map();
            let column = 1;
            let maxSizeInRow = 0;

            for (let i = 0; i < data.length; i++) {
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
                if (refState.current.positions.get(key) != null && refState.current.indexByKey.get(key) === i) {
                    newPositions.set(key, refState.current.positions.get(key)!);
                }
            }
            // getAnchorElementIndex needs indexByKey, build it first
            refState.current.indexByKey = indexByKey;
            refState.current.positions = newPositions;

            if (!isFirst) {
                // check if anchorElement is still in the list
                if (maintainVisibleContentPosition) {
                    if (
                        refState.current.anchorElement == null ||
                        indexByKey.get(refState.current.anchorElement.id) == null
                    ) {
                        if (data.length) {
                            const newAnchorElement = {
                                coordinate: 0,
                                id: getId(0),
                            };
                            refState.current.anchorElement = newAnchorElement;
                            refState.current.belowAnchorElementPositions?.clear();
                            // reset scroll to 0 and schedule rerender
                            refScroller.current?.scrollTo({ x: 0, y: 0, animated: false });
                            setTimeout(() => {
                                calculateItemsInView(0);
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
                        if (data.length) {
                            refState.current.startBufferedId = getId(0);
                        } else {
                            refState.current.startBufferedId = undefined;
                        }
                        // reset scroll to 0 and schedule rerender
                        refScroller.current?.scrollTo({ x: 0, y: 0, animated: false });
                        setTimeout(() => {
                            calculateItemsInView(0);
                        }, 0);
                    }
                }
            }

            const anchorElementIndex = getAnchorElementIndex();
            for (let i = 0; i < data.length; i++) {
                const key = getId(i);

                const size = getItemSize(key, i, data[i]);
                maxSizeInRow = Math.max(maxSizeInRow, size);

                column++;
                if (column > numColumnsProp) {
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
            addTotalSize(null, totalSize, totalSizeBelowIndex);
        }

        useEffect(() => {
            checkResetContainers(/*reset*/ !isFirst);
        }, [isFirst, data, numColumnsProp]);

        useEffect(() => {
            set$(ctx, "extraData", extraData);
        }, [extraData]);

        refState.current.renderItem = renderItem!;
        const lastItemKey = data.length > 0 ? getId(data.length - 1) : undefined;
        // TODO: This needs to support horizontal and other ways of defining padding
        const stylePaddingTop =
            StyleSheet.flatten(style)?.paddingTop ?? StyleSheet.flatten(contentContainerStyle)?.paddingTop ?? 0;

        const initalizeStateVars = () => {
            set$(ctx, "lastItemKey", lastItemKey);
            set$(ctx, "numColumns", numColumnsProp);
            set$(ctx, "stylePaddingTop", stylePaddingTop);
        };
        if (isFirst) {
            initalizeStateVars();
        }
        useEffect(initalizeStateVars, [lastItemKey, numColumnsProp, stylePaddingTop]);

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
                useViewability,
                useViewabilityAmount,
                useRecyclingEffect,
                useRecyclingState,
            });

            return { index, renderedItem };
        }, []);

        useInit(() => {
            const state = refState.current!;
            const viewability = setupViewability(props);
            state.viewabilityConfigCallbackPairs = viewability;
            state.enableScrollForNextCalculateItemsInView = !viewability;

            // Allocate containers
            const scrollLength = state.scrollLength;
            const averageItemSize = estimatedItemSize ?? getEstimatedItemSize?.(0, data[0]) ?? DEFAULT_ITEM_SIZE;
            const numContainers = Math.ceil((scrollLength + scrollBuffer * 2) / averageItemSize) * numColumnsProp;

            for (let i = 0; i < numContainers; i++) {
                set$(ctx, `containerPosition${i}`, ANCHORED_POSITION_OUT_OF_VIEW);
                set$(ctx, `containerColumn${i}`, -1);
            }

            set$(ctx, "numContainers", numContainers);
            set$(ctx, "numContainersPooled", numContainers * 2);

            calculateItemsInView(state.scrollVelocity);
        });

        const updateItemSize = useCallback((containerId: number, itemKey: string, size: number) => {
            const state = refState.current!;
            const { sizes, indexByKey, columns, sizesLaidOut, data } = state;
            if (!data) {
                return;
            }
            const index = indexByKey.get(itemKey)!;
            const numColumns = peek$<number>(ctx, "numColumns");

            state.minIndexSizeChanged =
                state.minIndexSizeChanged !== undefined ? Math.min(state.minIndexSizeChanged, index) : index;

            const prevSize = getItemSize(itemKey, index, data as any);

            if (!prevSize || Math.abs(prevSize - size) > 0.5) {
                let diff: number;

                if (numColumns > 1) {
                    sizes.set(itemKey, size);

                    const column = columns.get(itemKey);
                    const loopStart = index - (column! - 1);
                    let nextMaxSizeInRow = 0;
                    for (let i = loopStart; i < loopStart + numColumns && i < data.length; i++) {
                        const id = getId(i)!;
                        const size = getItemSize(id, i, data[i]);
                        nextMaxSizeInRow = Math.max(nextMaxSizeInRow, size);
                    }

                    diff = nextMaxSizeInRow - prevSize;
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

                // TODO: Could this be optimized to only calculate items in view that have changed?
                const scrollVelocity = state.scrollVelocity;
                // Calculate positions if not currently scrolling and have a calculate already pending
                if (!state.waitingForMicrotask && (Number.isNaN(scrollVelocity) || Math.abs(scrollVelocity) < 1)) {
                    if (!peek$(ctx, "containersDidLayout")) {
                        // Queue into a microtask if initial layout is still pending so we don't do a calculate for every item
                        state.waitingForMicrotask = true;
                        queueMicrotask(() => {
                            if (state.waitingForMicrotask) {
                                state.waitingForMicrotask = false;
                                calculateItemsInView(state.scrollVelocity);
                            }
                        });
                    } else {
                        calculateItemsInView(state.scrollVelocity);
                    }
                }

                if (onItemSizeChanged) {
                    onItemSizeChanged({ size, previous: prevSize, index, itemKey, itemData: data[index] });
                }
            }
        }, []);

        const handleScrollDebounced = useCallback((velocity: number) => {
            // Use velocity to predict scroll position
            calculateItemsInView(velocity);
            checkAtBottom();
            checkAtTop();
        }, []);

        const onLayout = useCallback((event: LayoutChangeEvent) => {
            const scrollLength = event.nativeEvent.layout[horizontal ? "width" : "height"];
            const didChange = scrollLength !== refState.current!.scrollLength;
            refState.current!.scrollLength = scrollLength;

            doMaintainScrollAtEnd(false);
            doUpdatePaddingTop();
            checkAtBottom();
            checkAtTop();

            if (didChange) {
                calculateItemsInView(0);
            }

            if (__DEV__) {
                const isWidthZero = event.nativeEvent.layout.width === 0;
                const isHeightZero = event.nativeEvent.layout.height === 0;
                if (isWidthZero || isHeightZero) {
                    console.warn(
                        `[legend-list] List ${isWidthZero ? "width" : "height"} is 0. You may need to set a style or \`flex: \` for the list, because children are absolutely positioned.`,
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
                state.hasScrolled = true;
                const currentTime = performance.now();
                const newScroll = event.nativeEvent.contentOffset[horizontal ? "x" : "y"];

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
                // Pass velocity to calculateItemsInView
                handleScrollDebounced(velocity);

                if (!fromSelf) {
                    onScrollProp?.(event as NativeSyntheticEvent<NativeScrollEvent>);
                }
            },
            [],
        );

        useImperativeHandle(
            forwardedRef,
            () => {
                const scrollToIndex = ({ index, animated }: Parameters<LegendListRef["scrollToIndex"]>[0]) => {
                    // naive implementation to search element by index
                    // TODO: create some accurate search algorithm
                    const offsetObj = calculateInitialOffset(index);
                    const offset = horizontal ? { x: offsetObj, y: 0 } : { x: 0, y: offsetObj };
                    refScroller.current!.scrollTo({ ...offset, animated });
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
                    scrollToItem: ({ item, animated }) => {
                        const index = data.indexOf(item);
                        if (index !== -1) {
                            scrollToIndex({ index, animated });
                        }
                    },
                    scrollToEnd: () => refScroller.current!.scrollToEnd(),
                };
            },
            [],
        );

        return (
            <ListComponent
                {...rest}
                horizontal={horizontal!}
                refScrollView={combinedRef}
                initialContentOffset={initialContentOffset}
                getRenderedItem={getRenderedItem}
                updateItemSize={updateItemSize}
                handleScroll={handleScroll}
                onLayout={onLayout}
                recycleItems={recycleItems}
                alignItemsAtEnd={alignItemsAtEnd}
                ListEmptyComponent={data.length === 0 ? ListEmptyComponent : undefined}
                maintainVisibleContentPosition={maintainVisibleContentPosition}
                scrollEventThrottle={scrollEventThrottle ?? (Platform.OS === "web" ? 16 : undefined)}
                waitForInitialLayout={waitForInitialLayout}
                style={style}
            />
        );
    }) as <T>(props: LegendListProps<T> & { ref?: ForwardedRef<LegendListRef> }) => ReactElement;
