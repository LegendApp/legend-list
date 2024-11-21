import * as React from 'react';
import { beginBatch, endBatch } from '@legendapp/state';
import { enableReactNativeComponents } from '@legendapp/state/config/enableReactNativeComponents';
import { Reactive, use$, useObservable } from '@legendapp/state/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions, ScrollView } from 'react-native';
import { Container } from './Container';
import type { LegendListProps } from './types';

enableReactNativeComponents();

const DEFAULT_SCROLL_BUFFER = 0;
const POSITION_OUT_OF_VIEW = -10000;

interface ContainerInfo {
    id: number;
    itemIndex: number;
    position: number;
}

interface VisibleRange {
    startBuffered: number;
    startNoBuffer: number;
    endBuffered: number;
    endNoBuffer: number;
    totalLength: number;
    scroll: number;
    topPad: number;
}

export function LegendList<T>(props: LegendListProps<T>) {
    const {
        data,
        reversed,
        initialScrollIndex,
        initialScrollOffset,
        horizontal,
        style,
        contentContainerStyle,
        initialContainers,
        drawDistance,
        recycleItems = true,
        onEndReachedThreshold,
        autoScrollToBottom = false,
        autoScrollToBottomThreshold = 0.1,
        keyExtractor,
        renderItem,
        estimatedItemLength,
        onEndReached,
        onViewableRangeChanged,
        ...rest
    } = props;
    const refScroller = useRef<ScrollView>(null);
    const containers$ = useObservable<ContainerInfo[]>(() => []);
    const visibleRange$ = useObservable<VisibleRange>(() => ({
        start: 0,
        end: 0,
        totalLength: 0,
        scroll: 0,
        topPad: 0,
    }));
    const scrollBuffer = drawDistance ?? DEFAULT_SCROLL_BUFFER;
    // Experimental: It works ok on iOS when scrolling up, but is doing weird things when sizes are changing.
    // And it doesn't work at all on Android because it uses contentInset. I'll try it again later.
    // Ideally it would work by adjusting the contentOffset but in previous attempts that was causing jitter.
    const supportsEstimationAdjustment = false; //   Platform.OS === "ios";

    const refPositions = useRef<{
        positions: Map<string, number>;
        lengths: Map<String, number>;
        pendingAdjust: number;
        animFrame: number | null;
        isStartReached: boolean;
        isEndReached: boolean;
        isAtBottom: boolean;
        data: T[];
        idsInFirstRender: Set<string>;
        hasScrolled: boolean;
    }>();
    const getId = (index: number): string => {
        const data = refPositions.current?.data;
        if (!data) {
            return '';
        }
        const ret = index < data.length ? (keyExtractor ? keyExtractor(data[index], index) : index) : null;
        return ret + '';
    };

    if (!refPositions.current) {
        refPositions.current = {
            lengths: new Map(),
            positions: new Map(),
            pendingAdjust: 0,
            animFrame: null,
            isStartReached: false,
            isEndReached: false,
            isAtBottom: false,
            data: data,
            idsInFirstRender: undefined as any,
            hasScrolled: false,
        };
        refPositions.current.idsInFirstRender = new Set(data.map((_: any, i: number) => getId(i)));
    }
    refPositions.current.data = data;

    const SCREEN_LENGTH = Dimensions.get('window')[horizontal ? 'width' : 'height'];

    const initialContentOffset =
        initialScrollOffset ??
        (initialScrollIndex ? initialScrollIndex * estimatedItemLength(initialScrollIndex) : undefined);

    const allocateContainers = useCallback(() => {
        const numContainers =
            initialContainers || Math.ceil((SCREEN_LENGTH + scrollBuffer * 2) / estimatedItemLength(0)) + 4;

        const containers: ContainerInfo[] = [];
        for (let i = 0; i < numContainers; i++) {
            containers.push({
                id: i,
                itemIndex: -1,
                position: POSITION_OUT_OF_VIEW,
            });
        }
        containers$.set(containers);
    }, []);

    const getRenderedItem = useCallback(
        (index: number) => {
            const data = refPositions.current?.data;
            if (!data) {
                return null;
            }
            const renderedItem = renderItem?.({
                item: data[index],
                index,
            } as any);

            return renderedItem;
        },
        [renderItem],
    );

    const calculateItemsInView = useCallback(() => {
        const data = refPositions.current!.data;
        if (!data) {
            return;
        }
        const scroll = visibleRange$.scroll.peek() - visibleRange$.topPad.peek();
        const containers = containers$.peek();

        const { lengths, positions } = refPositions.current!;

        let top = 0;
        let startNoBuffer: number | null = null;
        let startBuffered: number | null = null;
        let endNoBuffer: number | null = null;
        let endBuffered: number | null = null;

        const prevRange = onViewableRangeChanged ? { ...visibleRange$.peek() } : undefined;

        // TODO: This could be optimized to not start at 0, to go backwards from previous start position
        for (let i = 0; i < data!.length; i++) {
            const id = getId(i)!;
            const length = lengths.get(id) ?? estimatedItemLength(i);

            if (positions.get(id) !== top) {
                positions.set(id, top);
            }

            if (startNoBuffer === null && top + length > scroll) {
                startNoBuffer = i;
            }
            if (startBuffered === null && top + length > scroll - scrollBuffer) {
                startBuffered = i;
            }
            if (startNoBuffer !== null) {
                if (top <= scroll + SCREEN_LENGTH) {
                    endNoBuffer = i;
                }
                if (top <= scroll + SCREEN_LENGTH + scrollBuffer) {
                    endBuffered = i;
                } else {
                    break;
                }
            }

            top += length;
        }

        visibleRange$.assign({
            startBuffered: startBuffered!,
            startNoBuffer: startNoBuffer!,
            endBuffered: endBuffered!,
            endNoBuffer: endNoBuffer!,
        });

        beginBatch();

        if (startBuffered !== null && endBuffered !== null) {
            for (let i = startBuffered; i <= endBuffered; i++) {
                let isContained = false;
                // See if this item is already in a container
                for (let j = 0; j < containers.length; j++) {
                    const container = containers[j];
                    if (container.itemIndex === i) {
                        isContained = true;
                        break;
                    }
                }
                // If it's not in a container, then we need to recycle a container out of view
                if (!isContained) {
                    let didRecycle = false;
                    for (let u = 0; u < containers.length; u++) {
                        const container = containers[u];
                        if (container.itemIndex < startBuffered || container.itemIndex > endBuffered) {
                            containers$[u].itemIndex.set(i);
                            didRecycle = true;
                            break;
                        }
                    }
                    if (!didRecycle) {
                        if (__DEV__) {
                            console.warn(
                                '[legend-list] No container to recycle, consider increasing initialContainers or estimatedItemLength',
                                i,
                            );
                        }
                        containers$.push({
                            id: containers$.peek().length,
                            itemIndex: i,
                            position: POSITION_OUT_OF_VIEW,
                        });
                    }
                }
            }

            // Update top positions of all containers
            // TODO: This could be optimized to only update the containers that have changed
            // but it likely would have little impact. Remove this comment if not worth doing.
            for (let i = 0; i < containers.length; i++) {
                const container = containers[i];
                const item = data[container.itemIndex];
                if (item) {
                    const id = getId(container.itemIndex);
                    if (container.itemIndex < startBuffered || container.itemIndex > endBuffered) {
                        containers$[i].position.set(POSITION_OUT_OF_VIEW);
                    } else {
                        const pos = positions.get(id) ?? -1;
                        if (pos >= 0 && pos !== containers$[i].position.peek()) {
                            containers$[i].position.set(pos);
                        }
                    }
                }
            }

            // TODO: Add the more complex onViewableItemsChanged
            if (onViewableRangeChanged) {
                if (
                    startNoBuffer !== prevRange?.startNoBuffer ||
                    startBuffered !== prevRange?.startBuffered ||
                    endNoBuffer !== prevRange?.endNoBuffer ||
                    endBuffered !== prevRange?.endBuffered
                ) {
                    onViewableRangeChanged({
                        start: startNoBuffer!,
                        startBuffered,
                        end: endNoBuffer!,
                        endBuffered,
                        items: data.slice(startNoBuffer!, endNoBuffer! + 1),
                    });
                }
            }
        }

        endBatch();
    }, [data]);

    // const adjustTopPad = (diff: number) => {
    //     // TODO: Experimental, find a better way to do this.
    //     // Ideally we can do it by adjusting the contentOffset instead
    //     if (supportsEstimationAdjustment) {
    //         visibleRange$.topPad.set((v) => v - diff);
    //         const topPad = visibleRange$.topPad.peek();
    //         if (topPad > 0) {
    //             if (Platform.OS === 'ios') {
    //                 scrollRef.current?.setNativeProps({
    //                     contentInset: { top: topPad },
    //                 });
    //             } else {
    //             }
    //         }
    //     }
    // };

    useMemo(() => {
        allocateContainers();
        calculateItemsInView();

        // Set an initial total height based on what we know
        const lengths = refPositions.current?.lengths!;
        let totalLength = 0;
        for (let i = 0; i < data.length; i++) {
            const id = getId(i);

            totalLength += lengths.get(id) ?? estimatedItemLength(i);
        }
        visibleRange$.totalLength.set(totalLength);
    }, []);

    useMemo(() => {
        if (refPositions.current) {
            refPositions.current.isEndReached = false;
        }
    }, [data]);

    const containers = use$(containers$, { shallow: true });

    const updateItemLength = useCallback((index: number, length: number) => {
        const data = refPositions.current?.data;
        if (!data) {
            return;
        }
        const lengths = refPositions.current?.lengths!;
        const id = getId(index);
        const wasInFirstRender = refPositions.current?.idsInFirstRender.has(id);
        const prevLength = lengths.get(id) || (wasInFirstRender ? estimatedItemLength(index) : 0);
        // let scrollNeedsAdjust = 0;

        if (!prevLength || prevLength !== length) {
            beginBatch();

            // TODO: Experimental scroll adjusting
            // const diff = length - (prevLength || 0);
            // const startNoBuffer = visibleRange$.startNoBuffer.peek();
            // if (refPositions.current?.hasScrolled && wasInFirstRender && index <= startNoBuffer) {
            //     scrollNeedsAdjust += diff;
            // }

            lengths.set(id, length);
            visibleRange$.totalLength.set((prevTotal) => prevTotal + (length - prevLength));

            if (refPositions.current?.isAtBottom && autoScrollToBottom) {
                // TODO: This kinda works, but with a flash. Since setNativeProps is less ideal we'll favor the animated one for now.
                // scrollRef.current?.setNativeProps({
                //   contentContainerStyle: {
                //     height:
                //       visibleRange$.totalLength.get() + visibleRange$.topPad.get() + 48,
                //   },
                //   contentOffset: {
                //     y:
                //       visibleRange$.totalLength.peek() +
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

            // Calculate positions if not currently scrolling and have a calculate already pending
            if (!refPositions.current?.animFrame) {
                calculateItemsInView();
            }

            // TODO: Experimental
            // if (scrollNeedsAdjust) {
            //     adjustTopPad(scrollNeedsAdjust);
            // }
            endBatch();
        }
    }, []);

    const handleScrollDebounced = useCallback(() => {
        const newScroll = visibleRange$.scroll.peek();

        calculateItemsInView();
        // Check if at end
        const distanceFromEnd = visibleRange$.totalLength.peek() - newScroll - SCREEN_LENGTH;
        if (refPositions.current) {
            refPositions.current.isAtBottom = distanceFromEnd < SCREEN_LENGTH * autoScrollToBottomThreshold;
        }
        if (onEndReached && !refPositions.current?.isEndReached) {
            if (distanceFromEnd < (onEndReachedThreshold || 0.5) * SCREEN_LENGTH) {
                if (refPositions.current) {
                    refPositions.current.isEndReached = true;
                }
                onEndReached({ distanceFromEnd });
            }
        }

        // Reset the debounce
        if (refPositions.current) {
            refPositions.current.animFrame = null;
        }
    }, []);

    const handleScroll = useCallback((event: any) => {
        refPositions.current!.hasScrolled = true;
        const newScroll = event.nativeEvent.contentOffset[horizontal ? 'x' : 'y'];
        // Update the scroll position to use in checks
        visibleRange$.scroll.set(newScroll);

        // Debounce  a calculate if no calculate is already pending
        if (refPositions.current && !refPositions.current.animFrame) {
            refPositions.current.animFrame = requestAnimationFrame(handleScrollDebounced);
        }
    }, []);

    useEffect(() => {
        if (initialContentOffset) {
            handleScroll({
                nativeEvent: { contentOffset: { y: initialContentOffset } },
            });
            calculateItemsInView();
        }
    }, []);

    return (
        <Reactive.ScrollView
            style={[style, reversed ? { transform: horizontal ? [{ scaleX: -1 }] : [{ scaleY: -1 }] } : {}]}
            contentContainerStyle={[
                contentContainerStyle,
                horizontal
                    ? {
                          height: '100%',
                      }
                    : {},
            ]}
            onScroll={handleScroll}
            scrollEventThrottle={32}
            horizontal={horizontal}
            contentOffset={
                initialContentOffset
                    ? horizontal
                        ? { x: initialContentOffset, y: 0 }
                        : { x: 0, y: initialContentOffset }
                    : undefined
            }
            {...rest}
            ref={refScroller}
        >
            {/* {supportsEstimationAdjustment && (
                <Reactive.View
                    $style={() => ({
                        height: visibleRange$.topPad.get(),
                        width: '100%',
                    })}
                />
            )} */}

            <Reactive.View
                $style={() =>
                    horizontal
                        ? {
                              width: visibleRange$.totalLength.get(),
                          }
                        : {
                              height: visibleRange$.totalLength.get(),
                          }
                }
            >
                {containers.map((container, i) => (
                    <Container
                        reversed={reversed}
                        key={container.id}
                        recycleItems={recycleItems}
                        $container={containers$[i]}
                        listProps={props}
                        getRenderedItem={getRenderedItem}
                        onLayout={updateItemLength}
                    />
                ))}
            </Reactive.View>
        </Reactive.ScrollView>
    );
}
