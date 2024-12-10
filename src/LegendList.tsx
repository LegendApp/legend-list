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
    useState,
} from "react";
import {
    Dimensions,
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    type ScrollView,
    StyleSheet,
    unstable_batchedUpdates,
} from "react-native";
import { ListComponent } from "./ListComponent";
import { type ListenerType, StateProvider, listen$, peek$, set$, useStateContext } from "./state";
import type { LegendListRecyclingState, LegendListRef, ViewabilityAmountCallback, ViewabilityCallback } from "./types";
import type { InternalState, LegendListProps } from "./types";
import { useInit } from "./useInit";
import { setupViewability, updateViewableItems } from "./viewability";

const DEFAULT_SCROLL_BUFFER = 0;
const POSITION_OUT_OF_VIEW = -10000;
const INITIAL_SCROLL_ADJUST = 10000;

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
            style: styleProp,
            contentContainerStyle: contentContainerStyleProp,
            initialNumContainers,
            drawDistance = 250,
            recycleItems = false,
            onEndReachedThreshold = 0.5,
            maintainScrollAtEnd = false,
            maintainScrollAtEndThreshold = 0.1,
            alignItemsAtEnd = false,
            onScroll: onScrollProp,
            keyExtractor,
            renderItem,
            estimatedItemSize,
            getEstimatedItemSize,
            onEndReached,
            ListEmptyComponent,
            ...rest
        } = props;

        const ctx = useStateContext();

        const internalRef = useRef<ScrollView>(null);
        const refScroller = internalRef as React.MutableRefObject<ScrollView>;
        const scrollBuffer = drawDistance ?? DEFAULT_SCROLL_BUFFER;
        // Experimental: It works ok on iOS when scrolling up, but is doing weird things when sizes are changing.
        // And it doesn't work at all on Android because it uses contentInset. I'll try it again later.
        // Ideally it would work by adjusting the contentOffset but in previous attempts that was causing jitter.
        const supportsEstimationAdjustment = true; //   Platform.OS === "ios";

        const styleFlattened = StyleSheet.flatten(styleProp);
        const style = useMemo(() => styleFlattened, [JSON.stringify(styleFlattened)]);
        const contentContainerStyleFlattened = StyleSheet.flatten(contentContainerStyleProp);
        const contentContainerStyle = useMemo(
            () => contentContainerStyleFlattened,
            [JSON.stringify(contentContainerStyleProp)],
        );

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

            const size = getEstimatedItemSize ? getEstimatedItemSize(index, data) : estimatedItemSize;
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

                return offset + INITIAL_SCROLL_ADJUST;
            }
            return undefined;
        };

        const initialContentOffset = initialScrollOffset ?? useMemo(calculateInitialOffset, []);

        if (!refState.current) {
            refState.current = {
                sizes: new Map(),
                positions: new Map(),
                pendingAdjust: 0,
                animFrameScroll: null,
                animFrameLayout: null,
                animFrameTotalSize: null,
                isStartReached: false,
                isEndReached: false,
                isAtBottom: false,
                data,
                idsInFirstRender: undefined as never,
                hasScrolled: false,
                scrollLength: Dimensions.get("window")[horizontal ? "width" : "height"],
                startBuffered: 0,
                startNoBuffer: 0,
                endBuffered: 0,
                endNoBuffer: 0,
                scroll: initialContentOffset || 0,
                totalSize: 0,
                timeouts: new Set(),
                viewabilityConfigCallbackPairs: undefined as never,
                renderItem: undefined as never,
                scrollAdjustPending: INITIAL_SCROLL_ADJUST,
                nativeMarginTop: 0,
                indexByKey: new Map(),
            };
            refState.current.idsInFirstRender = new Set(data.map((_: unknown, i: number) => getId(i)));
            set$(ctx, "scrollAdjust", refState.current.scrollAdjustPending);
        }
        const adjustScroll = (diff: number) => {
            if (supportsEstimationAdjustment && refScroller.current) {
                // console.log("adjustScroll", diff);
                refState.current!.scrollAdjustPending -= diff;
            }
        };

        const isFirst = !refState.current.renderItem;
        // Run first time and whenever data changes
        if (isFirst || data !== refState.current.data) {
            refState.current.data = data;
            const indexByKey = new Map();
            for (let i = 0; i < data.length; i++) {
                const key = getId(i);
                indexByKey.set(key, i);

                // This maintains position when items are added by adding the estimated size to the top padding
                if (i < refState.current.startNoBuffer && !refState.current.indexByKey.has(key)) {
                    const size = getItemSize(key, i, data[i]);
                    adjustScroll(size);
                }
            }
            // This maintains positions when items are removed by removing their size from the top padding
            for (const [key, index] of refState.current.indexByKey) {
                if (index < refState.current.startNoBuffer && !indexByKey.has(key)) {
                    const size = refState.current.sizes.get(key) ?? 0;
                    if (size) {
                        adjustScroll(-size);
                    }
                }
            }
            refState.current.indexByKey = indexByKey;
        }
        refState.current.renderItem = renderItem!;
        set$(ctx, "numItems", data.length);
        // TODO: This needs to support horizontal and other ways of defining padding.
        set$(ctx, "stylePaddingTop", styleFlattened?.paddingTop ?? contentContainerStyleFlattened?.paddingTop ?? 0);

        const addTotalSize = useCallback((key: string | null, add: number) => {
            const index = key === null ? 0 : refState.current?.indexByKey.get(key)!;
            const isAbove = index < (refState.current?.startNoBuffer || 0);
            const prev = refState.current!.totalSize;
            refState.current!.totalSize += add;
            const totalSize = refState.current!.totalSize;
            const doAdd = () => {
                refState.current!.animFrameTotalSize = null;

                set$(ctx, "totalSize", totalSize);
                const screenLength = refState.current!.scrollLength;
                if (alignItemsAtEnd) {
                    const listPaddingTop = peek$<number>(ctx, "stylePaddingTop");
                    set$(ctx, "paddingTop", Math.max(0, screenLength - totalSize - listPaddingTop));
                }
            };
            // console.log("add size", add, isAbove, key, index, refState.current?.startNoBuffer || 0);
            if (isAbove) {
                adjustScroll(add);
            }
            if (!prev) {
                doAdd();
            } else if (!refState.current!.animFrameTotalSize) {
                refState.current!.animFrameTotalSize = requestAnimationFrame(doAdd);
            }
        }, []);

        const getRenderedItem = useCallback((key: string, containerId: number) => {
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
                const key = containerId + configId;

                useInit(() => {
                    const value = ctx.mapViewabilityValues.get(key);
                    if (value) {
                        callback(value);
                    }
                });

                ctx.mapViewabilityCallbacks.set(key, callback);

                useEffect(
                    () => () => {
                        ctx.mapViewabilityCallbacks.delete(key);
                    },
                    [],
                );
            };
            const useViewabilityAmount = (callback: ViewabilityAmountCallback) => {
                useInit(() => {
                    const value = ctx.mapViewabilityAmountValues.get(containerId);
                    if (value) {
                        callback(value);
                    }
                });

                ctx.mapViewabilityAmountCallbacks.set(containerId, callback);

                useEffect(
                    () => () => {
                        ctx.mapViewabilityAmountCallbacks.delete(containerId);
                    },
                    [],
                );
            };
            const useRecyclingEffect = (effect: (info: LegendListRecyclingState<unknown>) => void | (() => void)) => {
                useEffect(() => {
                    const state = refState.current!;
                    let prevIndex = index;
                    let prevItem = state.data[index];
                    const signal: ListenerType = `containerItemKey${containerId}`;

                    listen$(ctx, signal, () => {
                        const data = state.data;
                        if (data) {
                            const newKey = peek$<string>(ctx, signal);
                            const newIndex = state.indexByKey.get(newKey)!;
                            const newItem = data[newIndex];
                            if (newItem) {
                                effect({
                                    index: newIndex,
                                    item: newItem,
                                    prevIndex: prevIndex,
                                    prevItem: prevItem,
                                });
                            }

                            prevIndex = newIndex;
                            prevItem = newItem;
                        }
                    });
                }, []);
            };
            const useRecyclingState = (updateState: (info: LegendListRecyclingState<unknown>) => any) => {
                const stateInfo = useState(() =>
                    updateState({
                        index,
                        item: refState.current!.data[index],
                        prevIndex: undefined,
                        prevItem: undefined,
                    }),
                );

                useRecyclingEffect((state) => {
                    const newState = updateState(state);
                    stateInfo[1](newState);
                });

                return stateInfo;
            };

            const renderedItem = refState.current!.renderItem?.({
                item: data[index],
                index,
                useViewability,
                useViewabilityAmount,
                useRecyclingEffect,
                useRecyclingState,
            });

            return renderedItem;
        }, []);

        const calculateItemsInView = useCallback(() => {
            // This should be a good optimization to make sure that all React updates happen in one frame
            // but it should be tested more with and without it to see if it's better.
            unstable_batchedUpdates(() => {
                const {
                    data,
                    scrollLength,
                    scroll: scrollState,
                    startBuffered: startBufferedState,
                } = refState.current!;
                if (!data) {
                    return;
                }
                const topPad = (peek$<number>(ctx, "stylePaddingTop") || 0) + (peek$<number>(ctx, "headerSize") || 0);
                const scrollAdjustPending = refState.current!.scrollAdjustPending ?? 0;
                const scroll = Math.max(0, scrollState - topPad - scrollAdjustPending);

                const { sizes, positions } = refState.current!;

                let startNoBuffer: number | null = null;
                let startBuffered: number | null = null;
                let endNoBuffer: number | null = null;
                let endBuffered: number | null = null;

                // Go backwards from the last start position to find the first item that is in view
                // This is an optimization to avoid looping through all items, which could slow down
                // when scrolling at the end of a long list.
                let loopStart = startBufferedState || 0;
                if (startBufferedState) {
                    for (let i = startBufferedState; i >= 0; i--) {
                        const id = getId(i)!;
                        const top = positions.get(id)!;
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
                }

                let top = loopStart > 0 ? positions.get(getId(loopStart))! : 0;

                for (let i = loopStart; i < data!.length; i++) {
                    const id = getId(i)!;
                    const size = getItemSize(id, i, data[i]);

                    if (positions.get(id) !== top) {
                        positions.set(id, top);
                    }

                    if (startNoBuffer === null && top + size > scroll) {
                        startNoBuffer = i;
                    }
                    if (startBuffered === null && top + size > scroll - scrollBuffer) {
                        startBuffered = i;
                    }
                    if (startNoBuffer !== null) {
                        if (top <= scroll + scrollLength) {
                            endNoBuffer = i;
                        }
                        if (top <= scroll + scrollLength + scrollBuffer) {
                            endBuffered = i;
                        } else {
                            break;
                        }
                    }

                    top += size;
                }

                Object.assign(refState.current!, {
                    startBuffered,
                    startNoBuffer,
                    endBuffered,
                    endNoBuffer,
                });

                // console.log("start", startBuffered, startNoBuffer, endNoBuffer, endBuffered);

                if (startBuffered !== null && endBuffered !== null) {
                    const prevNumContainers = ctx.values.get("numContainers");
                    let numContainers = prevNumContainers;
                    for (let i = startBuffered; i <= endBuffered; i++) {
                        let isContained = false;
                        const id = getId(i)!;
                        // See if this item is already in a container
                        for (let j = 0; j < numContainers; j++) {
                            // const index = peek$(ctx, `containerItemIndex${j}`);
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

                                const index = refState.current?.indexByKey.get(key)!;
                                const pos = peek$<number>(ctx, `containerPosition${u}`);

                                if (index < startBuffered || index > endBuffered) {
                                    const distance = Math.abs(pos - top);
                                    if (index < 0 || distance > furthestDistance) {
                                        furthestDistance = distance;
                                        furthestIndex = u;
                                    }
                                }
                            }
                            if (furthestIndex >= 0) {
                                // set$(ctx, `containerItemIndex${furthestIndex}`, i);
                                set$(ctx, `containerItemKey${furthestIndex}`, id);
                            } else {
                                if (__DEV__) {
                                    console.warn(
                                        "[legend-list] No container to recycle, consider increasing initialContainers or estimatedItemSize. numContainers:",
                                        numContainers,
                                    );
                                }
                                const containerId = numContainers;

                                numContainers++;
                                // set$(ctx, `containerItemIndex${containerId}`, i);
                                set$(ctx, `containerItemKey${containerId}`, id);

                                // TODO: This may not be necessary as it'll get st in the next loop?
                                set$(ctx, `containerPosition${containerId}`, POSITION_OUT_OF_VIEW);
                            }
                        }
                    }

                    if (numContainers !== prevNumContainers) {
                        set$(ctx, "numContainers", numContainers);
                    }

                    // Update top positions of all containers
                    // TODO: This could be optimized to only update the containers that have changed
                    // but it likely would have little impact. Remove this comment if not worth doing.
                    for (let i = 0; i < numContainers; i++) {
                        // const itemIndex = peek$<nu(ctx, `containerItemIndex${i}`);
                        const itemKey = peek$<string>(ctx, `containerItemKey${i}`);
                        const itemIndex = refState.current?.indexByKey.get(itemKey)!;
                        const item = data[itemIndex];
                        if (item) {
                            const id = getId(itemIndex);
                            if (itemKey !== id || itemIndex < startBuffered || itemIndex > endBuffered) {
                                set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                            } else {
                                const pos = positions.get(id) ?? -1;
                                const prevPos = peek$(ctx, `containerPosition${i}`);
                                if (pos >= 0 && pos !== prevPos) {
                                    // console.log("pos", itemIndex, pos, pos + scrollAdjustPending);
                                    set$(ctx, `containerPosition${i}`, pos + scrollAdjustPending);
                                    // if (itemIndex === startNoBuffer && prevPos >= 0) {
                                    //     const amtToAdjust = pos - prevPos;
                                    //     if (amtToAdjust !== 0) {
                                    //         console.log("startNoBuffer", itemIndex, amtToAdjust, pos, prevPos);
                                    //         // requestAnimationFrame(() => adjustScroll(amtToAdjust));
                                    //     }
                                    // }
                                }
                            }
                        }
                    }
                }

                if (refState.current!.viewabilityConfigCallbackPairs) {
                    updateViewableItems(
                        refState.current!,
                        ctx,
                        refState.current!.viewabilityConfigCallbackPairs,
                        getId,
                        scrollLength,
                        startNoBuffer!,
                        endNoBuffer!,
                    );
                }
            });
        }, []);

        useInit(() => {
            refState.current!.viewabilityConfigCallbackPairs = setupViewability(props);

            // Allocate containers
            const scrollLength = refState.current!.scrollLength;
            const averageItemSize = estimatedItemSize ?? getEstimatedItemSize?.(0, data[0]);
            const numContainers =
                initialNumContainers || Math.ceil((scrollLength + scrollBuffer * 2) / averageItemSize) + 4;

            for (let i = 0; i < numContainers; i++) {
                // set$(ctx, `containerItemIndex${i}`, -1);
                set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
            }

            set$(ctx, "numContainers", numContainers);

            calculateItemsInView();

            // Set an initial total height based on what we know
            let totalSize = 0;
            for (let i = 0; i < data.length; i++) {
                const id = getId(i);
                totalSize += getItemSize(id, i, data[i]);
            }
            addTotalSize(null, totalSize);
        });

        const checkAtBottom = () => {
            const { scrollLength, scroll } = refState.current!;
            const totalSize = peek$<number>(ctx, "totalSize");
            // Check if at end
            const distanceFromEnd = totalSize - scroll - scrollLength;
            if (refState.current) {
                refState.current.isAtBottom = distanceFromEnd < scrollLength * maintainScrollAtEndThreshold;
            }
            if (onEndReached && !refState.current?.isEndReached) {
                if (distanceFromEnd < onEndReachedThreshold! * scrollLength) {
                    if (refState.current) {
                        refState.current.isEndReached = true;
                    }
                    onEndReached({ distanceFromEnd });
                }
            }
        };

        useEffect(() => {
            if (refState.current) {
                refState.current.isEndReached = false;
            }

            // Reset containers that aren't used anymore because the data has changed
            const numContainers = peek$<number>(ctx, "numContainers");
            if (data.length < numContainers) {
                for (let i = 0; i < numContainers; i++) {
                    const itemKey = peek$<string>(ctx, `containerItemKey${i}`);
                    if (refState.current?.indexByKey.get(itemKey) === undefined) {
                        set$(ctx, `containerItemKey${i}`, null);
                    }
                }
            }

            calculateItemsInView();
            checkAtBottom();
        }, [data]);

        const updateItemSize = useCallback((key: string, size: number) => {
            const data = refState.current?.data;
            if (!data) {
                return;
            }
            const sizes = refState.current!.sizes!;
            const index = refState.current?.indexByKey.get(key)!;
            // TODO: I don't love this, can do it better?
            const wasInFirstRender = refState.current?.idsInFirstRender.has(key);

            const prevSize = sizes.get(key) || (wasInFirstRender ? getItemSize(key, index, data[index]) : 0);
            // let scrollNeedsAdjust = 0;

            if (!prevSize || Math.abs(prevSize - size) > 0.5) {
                // TODO: Experimental scroll adjusting
                // const diff = length - (prevLength || 0);
                // const startNoBuffer = visibleRange$.startNoBuffer.peek();
                // if (refPositions.current?.hasScrolled && wasInFirstRender && index <= startNoBuffer) {
                //     scrollNeedsAdjust += diff;
                // }

                // console.log("size diff", key, size, prevSize);

                sizes.set(key, size);
                addTotalSize(key, size - prevSize);

                if (refState.current?.isAtBottom && maintainScrollAtEnd) {
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

                    // TODO: This kinda works too, but with more of a flash
                    requestAnimationFrame(() => {
                        refScroller.current?.scrollToEnd({
                            animated: true,
                        });
                    });
                }

                // TODO: Could this be optimized to only calculate items in view that have changed?
                const state = refState.current!;
                // Calculate positions if not currently scrolling and have a calculate already pending
                if (!state.animFrameScroll && !state.animFrameLayout) {
                    state.animFrameLayout = requestAnimationFrame(() => {
                        state.animFrameLayout = null;
                        calculateItemsInView();
                    });
                }
            }
        }, []);

        const handleScrollDebounced = useCallback(() => {
            const scrollAdjustPending = refState.current?.scrollAdjustPending ?? 0;

            set$(ctx, "scrollAdjust", scrollAdjustPending);

            calculateItemsInView();
            checkAtBottom();

            if (refState.current) {
                // Reset the debounce
                refState.current.animFrameScroll = null;
            }
        }, []);

        const onLayout = useCallback((event: LayoutChangeEvent) => {
            const scrollLength = event.nativeEvent.layout[horizontal ? "width" : "height"];
            refState.current!.scrollLength = scrollLength;

            if (__DEV__) {
                const isWidthZero = event.nativeEvent.layout.width === 0;
                const isHeightZero = event.nativeEvent.layout.height === 0;
                if (isWidthZero || isHeightZero) {
                    console.warn(
                        `[legend-list] List ${isWidthZero ? "width" : "height"} is 0. You may need to set a style or \`flex: \` for the list, because children are absolutely positioned.`,
                    );
                }
            }
        }, []);

        const handleScroll = useCallback(
            (
                event: {
                    nativeEvent: NativeScrollEvent;
                },
                fromSelf?: boolean,
            ) => {
                // in some cases when we set ScrollView contentOffset prop, there comes event from with 0 height and width
                // this causes blank list display, looks to be Paper implementation problem
                // let's filter out such events
                if (event.nativeEvent?.contentSize?.height === 0 && event.nativeEvent.contentSize?.width === 0) {
                    return;
                }
                refState.current!.hasScrolled = true;
                const newScroll = event.nativeEvent.contentOffset[horizontal ? "x" : "y"];
                // Update the scroll position to use in checks
                refState.current!.scroll = newScroll;

                // Debounce a calculate if no calculate is already pending
                if (refState.current && !refState.current.animFrameScroll) {
                    refState.current.animFrameScroll = requestAnimationFrame(handleScrollDebounced);
                }

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
                    // FlashList seems to be able to find index in the dynamic size list with some search
                    const offsetObj = calculateInitialOffset(index);
                    const offset = horizontal ? { x: offsetObj, y: 0 } : { x: 0, y: offsetObj };
                    refScroller.current!.scrollTo({ ...offset, animated });
                };
                return {
                    getNativeScrollRef: () => refScroller.current!,
                    getScrollableNode: refScroller.current!.getScrollableNode,
                    getScrollResponder: refScroller.current!.getScrollResponder,
                    flashScrollIndicators: refScroller.current!.flashScrollIndicators,
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
                    scrollToEnd: refScroller.current!.scrollToEnd,
                };
            },
            [],
        );

        return (
            <ListComponent
                {...rest}
                contentContainerStyle={contentContainerStyle}
                style={[style]}
                horizontal={horizontal!}
                refScroller={refScroller}
                initialContentOffset={initialContentOffset}
                getRenderedItem={getRenderedItem}
                updateItemSize={updateItemSize}
                handleScroll={handleScroll}
                onLayout={onLayout}
                recycleItems={recycleItems}
                alignItemsAtEnd={alignItemsAtEnd}
                addTotalSize={addTotalSize}
                ListEmptyComponent={data.length === 0 ? ListEmptyComponent : undefined}
            />
        );
    }) as <T>(props: LegendListProps<T> & { ref?: ForwardedRef<LegendListRef> }) => ReactElement;
