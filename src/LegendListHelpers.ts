import { peek$, set$ } from './state';
import { OPTIMIZE_DIRECTION, POSITION_OUT_OF_VIEW } from './constants';
import type { LegendListProps, InternalState } from './types';
import {
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    unstable_batchedUpdates,
} from 'react-native';

export function applyDefaultProps(props: LegendListProps<any>) {
    return {
        ...props,
        recycleItems: props.recycleItems || false,
        onEndReachedThreshold: props.onEndReachedThreshold || 0.5,
        maintainScrollAtEndThreshold: props.maintainScrollAtEndThreshold || 0.1,
        maintainScrollAtEnd: props.maintainScrollAtEnd || false,
        alignItemsAtEnd: props.alignItemsAtEnd || false,
    };
}

export function allocateContainers(state: InternalState) {
    const { scrollSize: scrollSize, props, ctx, scrollBuffer } = state;
    const averageItemSize = props.estimatedItemSize ?? props.getEstimatedItemSize?.(0, props.data[0]);
    const numContainers =
        props.initialNumContainers || Math.ceil((scrollSize + scrollBuffer * 2) / averageItemSize) + 4;

    for (let i = 0; i < numContainers; i++) {
        set$(ctx, `containerIndex${i}`, -1);
        set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
    }

    set$(ctx, `numContainers`, numContainers);
}

export function getId(state: InternalState, index: number) {
    const { data, keyExtractor } = state.props;
    if (!data) {
        return '';
    }
    const ret = index < data.length ? (keyExtractor ? keyExtractor(data[index], index) : index) : null;
    return ret + '';
}

export function calculateInitialOffset(props: LegendListProps<any>) {
    const { data, initialScrollIndex, estimatedItemSize, getEstimatedItemSize } = props;
    if (initialScrollIndex) {
        if (getEstimatedItemSize) {
            let offset = 0;
            for (let i = 0; i < initialScrollIndex; i++) {
                offset += getEstimatedItemSize(i, data[i]);
            }
            return offset;
        } else if (estimatedItemSize) {
            return initialScrollIndex * estimatedItemSize;
        }
    }
    return undefined;
}

export function addTotalSize(state: InternalState, add: number) {
    const { ctx, props } = state;
    const totalSize = (peek$(ctx, `totalSize`) || 0) + add;
    set$(ctx, `totalSize`, totalSize);
    const scrollSize = state.scrollSize;
    if (props.alignItemsAtEnd) {
        const listPaddingTop = peek$(ctx, `stylePaddingTop`);
        set$(ctx, `paddingTop`, Math.max(0, scrollSize - totalSize - listPaddingTop));
    }
}

export function getRenderedItem(state: InternalState, index: number) {
    const { data, renderItem } = state.props;
    if (!data) {
        return null;
    }
    const renderedItem = renderItem?.({
        item: data[index],
        index,
    } as any);

    return renderedItem;
}

export const getItemSize = (state: InternalState, index: number, data: any[]) => {
    const { getEstimatedItemSize, estimatedItemSize } = state.props;
    return getEstimatedItemSize ? getEstimatedItemSize(index, data) : estimatedItemSize;
};

export function calculateItemsInView(state: InternalState) {
    // This should be a good optimization to make sure that all React updates happen in one frame
    // but it should be tested more with and without it to see if it's better.
    unstable_batchedUpdates(() => {
        const {
            props: { data, onViewableRangeChanged },
            scrollSize: scrollSize,
            scroll: scrollState,
            startNoBuffer: startNoBufferState,
            startBuffered: startBufferedState,
            endNoBuffer: endNoBufferState,
            endBuffered: endBufferedState,
            sizes,
            positions,
            scrollBuffer,
            ctx,
        } = state;

        if (!data) {
            return;
        }
        const topPad = (peek$(ctx, `stylePaddingTop`) || 0) + (peek$(ctx, `headerSize`) || 0);
        const scroll = scrollState - topPad;
        const direction = scroll > state.scrollPrevious ? 1 : -1;
        const optimizeDirection = OPTIMIZE_DIRECTION;
        const scrollBufferTop = optimizeDirection
            ? direction > 0
                ? scrollBuffer * 0.5
                : scrollBuffer * 1.5
            : scrollBuffer;
        const scrollBufferBottom = optimizeDirection
            ? direction > 0
                ? scrollBuffer * 1.5
                : scrollBuffer * 0.5
            : scrollBuffer;

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
                const id = getId(state, i)!;
                const top = positions.get(id)!;
                if (top !== undefined) {
                    const size = sizes.get(id) ?? getItemSize(state, i, data[i]);
                    const bottom = top + size;
                    if (bottom > scroll - scrollBufferTop) {
                        loopStart = i;
                    } else {
                        break;
                    }
                }
            }
        }

        let scrollUpDistanceToChange = 0;

        let top = loopStart > 0 ? positions.get(getId(state, loopStart))! : 0;

        for (let i = loopStart; i < data!.length; i++) {
            const id = getId(state, i)!;
            const size = sizes.get(id) ?? getItemSize(state, i, data[i]);

            if (positions.get(id) !== top) {
                positions.set(id, top);
            }

            if (startNoBuffer === null && top + size > scroll) {
                startNoBuffer = i;
            }
            if (startBuffered === null && top + size > scroll - scrollBufferTop) {
                startBuffered = i;
            }
            if (startNoBuffer !== null) {
                if (top <= scroll + scrollSize) {
                    endNoBuffer = i;
                }
                if (top <= scroll + scrollSize + scrollBufferBottom) {
                    endBuffered = i;
                } else {
                    break;
                }
            }

            top += size;
        }

        Object.assign(state, {
            startBuffered,
            startNoBuffer,
            endBuffered,
            endNoBuffer,
        });

        if (startBuffered !== null && endBuffered !== null) {
            const prevNumContainers = ctx.values.get('numContainers');
            let numContainers = prevNumContainers;
            for (let i = startBuffered; i <= endBuffered; i++) {
                let isContained = false;
                // See if this item is already in a container
                for (let j = 0; j < numContainers; j++) {
                    const index = peek$(ctx, `containerIndex${j}`);
                    if (index === i) {
                        isContained = true;
                        break;
                    }
                }
                // If it's not in a container, then we need to recycle a container out of view
                if (!isContained) {
                    const id = getId(state, i)!;
                    const top = positions.get(id) || 0;
                    let furthestIndex = -1;
                    let furthestDistance = 0;
                    // Find the furthest container so we can recycle a container from the other side of scroll
                    // to reduce empty container flashing when switching directions
                    // Note that since this is only checking top it may not be 100% accurate but that's fine.
                    for (let u = 0; u < numContainers; u++) {
                        const index = peek$(ctx, `containerIndex${u}`);
                        if (index < 0) {
                            furthestIndex = u;
                            break;
                        }

                        const pos = peek$(ctx, `containerPosition${u}`);
                        if (index < startBuffered || index > endBuffered) {
                            const distance = Math.abs(pos - top);
                            if (index < 0 || distance > furthestDistance) {
                                furthestDistance = distance;
                                furthestIndex = u;
                            }
                        }
                    }

                    if (furthestIndex >= 0) {
                        set$(ctx, `containerIndex${furthestIndex}`, i);
                    } else {
                        if (__DEV__) {
                            console.warn(
                                '[legend-list] No container to recycle, consider increasing initialContainers or estimatedItemSize',
                                i,
                            );
                        }
                        const containerId = numContainers;
                        numContainers++;
                        set$(ctx, `containerIndex${containerId}`, i);
                        set$(ctx, `containerPosition${containerId}`, POSITION_OUT_OF_VIEW);
                    }
                }
            }

            if (numContainers !== prevNumContainers) {
                set$(ctx, `numContainers`, numContainers);
            }

            // Update top positions of all containers
            // TODO: This could be optimized to only update the containers that have changed
            // but it likely would have little impact. Remove this comment if not worth doing.
            for (let i = 0; i < numContainers; i++) {
                const itemIndex = peek$(ctx, `containerIndex${i}`);
                const item = data[itemIndex];
                if (item) {
                    const id = getId(state, itemIndex);
                    if (itemIndex < startBuffered || itemIndex > endBuffered) {
                        // TODO: I think this was needed to fix initialScrollOffset.
                        // Maybe we need to reset containers out of view
                        // when data changes. Or maybe it was when adding items?
                        // set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                    } else {
                        const pos = positions.get(id) ?? -1;
                        const prevPos = peek$(ctx, `containerPosition${i}`);
                        if (pos >= 0 && pos !== prevPos) {
                            set$(ctx, `containerPosition${i}`, pos);
                        }
                    }
                }
            }

            // TODO: Add the more complex onViewableItemsChanged
            if (onViewableRangeChanged) {
                if (
                    startNoBuffer !== startNoBufferState ||
                    startBuffered !== startBufferedState ||
                    endNoBuffer !== endNoBufferState ||
                    endBuffered !== endBufferedState
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
    });
}

export function updateItemSize(
    state: InternalState,
    refScroller: React.RefObject<ScrollView>,
    index: number,
    size: number,
) {
    const {
        props: { data, maintainScrollAtEnd },
        ctx,
        sizes,
        idsInFirstRender,
        isAtBottom,
    } = state;
    if (!data) {
        return;
    }
    const id = getId(state, index);
    const wasInFirstRender = idsInFirstRender.has(id);

    const prevSize = sizes.get(id) || (wasInFirstRender ? getItemSize(state, index, data[index]) : 0);
    // let scrollNeedsAdjust = 0;

    if (!prevSize || prevSize !== size) {
        // TODO: Experimental scroll adjusting
        // const diff = length - (prevLength || 0);
        // const startNoBuffer = visibleRange$.startNoBuffer.peek();
        // if (refPositions.current?.hasScrolled && wasInFirstRender && index <= startNoBuffer) {
        //     scrollNeedsAdjust += diff;
        // }

        sizes.set(id, size);
        addTotalSize(state, size - prevSize);

        if (isAtBottom && maintainScrollAtEnd) {
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

        // Calculate positions if not currently scrolling and have a calculate already pending
        if (!state.animFrameScroll && !state.animFrameLayout) {
            state.animFrameLayout = requestAnimationFrame(() => {
                state.animFrameLayout = null;
                if (!state.animFrameScroll) {
                    calculateItemsInView(state);
                }
            });
        }

        // TODO: Experimental
        // if (scrollNeedsAdjust) {
        //     adjustTopPad(scrollNeedsAdjust);
        // }
    }
}

export function checkAtBottom(state: InternalState) {
    const {
        ctx,
        scrollSize,
        scroll,
        props: { maintainScrollAtEndThreshold, onEndReached, onEndReachedThreshold },
    } = state!;
    const totalSize = peek$(ctx, 'totalSize');
    // Check if at end
    const distanceFromEnd = totalSize - scroll - scrollSize;
    state.isAtBottom = distanceFromEnd < scrollSize * maintainScrollAtEndThreshold!;
    if (onEndReached && !state.isEndReached) {
        if (distanceFromEnd < onEndReachedThreshold! * scrollSize) {
            state.isEndReached = true;
            onEndReached({ distanceFromEnd });
        }
    }
}

export function handleScrollDebounced(state: InternalState) {
    calculateItemsInView(state);
    checkAtBottom(state);

    // Reset the debounce
    state.animFrameScroll = null;
}

export function handleScroll(
    state: InternalState,
    onScrollDebounced: () => void,
    event: {
        nativeEvent: NativeScrollEvent;
    },
) {
    // in some cases when we set ScrollView contentOffset prop, there comes event from with 0 height and width
    // this causes blank list display, looks to be Paper implementation problem
    // let's filter out such events
    if (event.nativeEvent?.contentSize?.height === 0 && event.nativeEvent.contentSize?.width === 0) {
        return;
    }
    const { horizontal, onScroll } = state.props;
    state.hasScrolled = true;
    const newScroll = event.nativeEvent.contentOffset[horizontal ? 'x' : 'y'];
    // Update the scroll position to use in checks
    state.scrollPrevious = state.scroll;
    state.scroll = newScroll;

    // Debounce a calculate if no calculate is already pending
    if (state && !state.animFrameScroll) {
        state.animFrameScroll = requestAnimationFrame(onScrollDebounced);
    }

    onScroll?.(event as NativeSyntheticEvent<NativeScrollEvent>);
}

export function onLayout(state: InternalState, event: LayoutChangeEvent) {
    const scrollSize = event.nativeEvent.layout[state.props.horizontal ? 'width' : 'height'];
    state.scrollSize = scrollSize;
}
