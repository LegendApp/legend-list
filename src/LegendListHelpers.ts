import { peek$, set$ } from './state';
import { OPTIMIZE_DIRECTION, POSITION_OUT_OF_VIEW } from './constants';
import { LegendListProps, InternalState, LegendListPropsDefaulted } from './types';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  unstable_batchedUpdates,
} from 'react-native';

export const applyDefaultProps = <TData>(props: LegendListProps<TData>): LegendListPropsDefaulted<TData> => {
  return {
    ...props,
    recycleItems: props.recycleItems ?? false,
    onEndReachedThreshold: props.onEndReachedThreshold ?? 0.5,
    maintainScrollAtEndThreshold: props.maintainScrollAtEndThreshold ?? 0.1,
    maintainScrollAtEnd: props.maintainScrollAtEnd ?? false,
    alignItemsAtEnd: props.alignItemsAtEnd ?? false,
  };
};

export const allocateContainers = <TData>(state: InternalState<TData>) => {
  const { scrollLength, props, ctx, scrollBuffer } = state;
  const averageItemSize = 'estimatedItemSize' in props ? (props.getEstimatedItemSize?.(0, props.data[0]) ?? 0) : 0;
  const numContainers =
    props.initialNumContainers ?? Math.ceil((scrollLength + scrollBuffer * 2) / averageItemSize) + 4;

  for (let i = 0; i < numContainers; i++) {
    set$(ctx, `containerIndex${i}`, -1);
    set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
  }

  set$(ctx, `numContainers`, numContainers);
};

export function getId<TData>(props: Pick<InternalState<TData>['props'], 'data' | 'keyExtractor'>, index: number) {
  const { data, keyExtractor } = props;
  return index < data.length ? (keyExtractor ? keyExtractor(data[index], index) : `${index}`) : '';
}

export const calculateInitialOffset = <TData>(props: LegendListProps<TData>) => {
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
};

export const addTotalLength = <TData>(state: InternalState<TData>, add: number) => {
  const { ctx, props } = state;
  const totalLength = (peek$(ctx, `totalLength`) ?? 0) + add;
  set$(ctx, `totalLength`, totalLength);
  const screenLength = state.scrollLength;
  if (props.alignItemsAtEnd) {
    const listPaddingTop = peek$(ctx, `stylePaddingTop`) ? Number(peek$(ctx, `stylePaddingTop`)) : 0;
    set$(ctx, `paddingTop`, Math.max(0, screenLength - totalLength - listPaddingTop));
  }
};

export const getRenderedItem = <TData>(
  props: Pick<InternalState<TData>['props'], 'data' | 'renderItem'>,
  index: number,
) => {
  const { data, renderItem } = props;
  return renderItem?.({ item: data[index], index });
};

export const getItemSize = <TData>(state: InternalState<TData>, index: number, data: TData) => {
  const { getEstimatedItemSize, estimatedItemSize } = state.props;
  return getEstimatedItemSize ? getEstimatedItemSize(index, data) : estimatedItemSize;
};

export function calculateItemsInView<TData>(state: InternalState<TData>) {
  // This should be a good optimization to make sure that all React updates happen in one frame
  // but it should be tested more with and without it to see if it's better.
  unstable_batchedUpdates(() => {
    const {
      props: { data, onViewableRangeChanged },
      scrollLength,
      scroll: scrollState,
      startNoBuffer: startNoBufferState,
      startBuffered: startBufferedState,
      endNoBuffer: endNoBufferState,
      endBuffered: endBufferedState,
      lengths,
      positions,
      scrollBuffer,
      ctx,
    } = state;

    const topPad =
      (peek$(ctx, `stylePaddingTop`) ? Number(peek$(ctx, `stylePaddingTop`)) : 0) + (peek$(ctx, `headerSize`) ?? 0);
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
        const id = getId(state.props, i);
        const top = positions.get(id);
        if (top != undefined) {
          const length = lengths.get(id) ?? getItemSize(state, i, data[i]);
          const bottom = top + length;
          if (bottom > scroll - scrollBufferTop) {
            loopStart = i;
          } else {
            break;
          }
        }
      }
    }

    // const scrollUpDistanceToChange = 0;

    let top = loopStart > 0 ? positions.get(getId(state.props, loopStart)) : 0;

    for (let i = loopStart; i < data.length; i++) {
      if (top == null) break;
      const id = getId(state.props, i);
      const length = lengths.get(id) ?? getItemSize(state, i, data[i]);

      if (positions.get(id) !== top) {
        positions.set(id, top);
      }

      if (startNoBuffer === null && top + length > scroll) {
        startNoBuffer = i;
      }
      if (startBuffered === null && top + length > scroll - scrollBufferTop) {
        startBuffered = i;
      }
      if (startNoBuffer !== null) {
        if (top <= scroll + scrollLength) {
          endNoBuffer = i;
        }
        if (top <= scroll + scrollLength + scrollBufferBottom) {
          endBuffered = i;
        } else {
          break;
        }
      }

      top += length;
    }

    Object.assign(state, {
      startBuffered,
      startNoBuffer,
      endBuffered,
      endNoBuffer,
    });

    if (startBuffered !== null && endBuffered !== null) {
      const prevNumContainers = ctx.values.numContainers ?? 0;
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
          const id = getId(state.props, i);
          const top = positions.get(id) ?? 0;
          let furthestIndex = -1;
          let furthestDistance = 0;
          // Find the furthest container so we can recycle a container from the other side of scroll
          // to reduce empty container flashing when switching directions
          // Note that since this is only checking top it may not be 100% accurate but that's fine.
          for (let u = 0; u < numContainers; u++) {
            const index = peek$(ctx, `containerIndex${u}`);
            if (index != null && index < 0) {
              furthestIndex = u;
              break;
            }

            const pos = peek$(ctx, `containerPosition${u}`) ?? 0;
            if (index != null && (index < startBuffered || index > endBuffered)) {
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
                '[legend-list] No container to recycle, consider increasing initialContainers or estimatedItemLength',
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
        const itemIndex = peek$(ctx, `containerIndex${i}`) ?? 0;
        const item = data[itemIndex];
        if (item) {
          const id = getId(state.props, itemIndex);
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
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
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
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
    }
  });
}

export const updateItemSize = <TData>(
  state: InternalState<TData>,
  refScroller: React.RefObject<ScrollView>,
  index: number,
  length: number,
) => {
  const {
    props: { data, maintainScrollAtEnd },
    lengths,
    idsInFirstRender,
    isAtBottom,
  } = state;
  const id = getId(state.props, index);
  const wasInFirstRender = idsInFirstRender.has(id);

  const prevLength = lengths.get(id) ?? (wasInFirstRender ? getItemSize(state, index, data[index]) : 0);
  // let scrollNeedsAdjust = 0;

  if (!prevLength || prevLength !== length) {
    // TODO: Experimental scroll adjusting
    // const diff = length - (prevLength || 0);
    // const startNoBuffer = visibleRange$.startNoBuffer.peek();
    // if (refPositions.current?.hasScrolled && wasInFirstRender && index <= startNoBuffer) {
    //     scrollNeedsAdjust += diff;
    // }

    lengths.set(id, length);
    addTotalLength(state, length - prevLength);

    if (isAtBottom && maintainScrollAtEnd) {
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
};

export const checkAtBottom = <TData>(state: InternalState<TData>) => {
  const {
    ctx,
    scrollLength,
    scroll,
    props: { maintainScrollAtEndThreshold, onEndReached, onEndReachedThreshold },
  } = state;
  const totalLength = peek$(ctx, 'totalLength') ?? 0;
  // Check if at end
  const distanceFromEnd = totalLength - scroll - scrollLength;
  state.isAtBottom = distanceFromEnd < scrollLength * maintainScrollAtEndThreshold;
  if (onEndReached && !state.isEndReached) {
    if (distanceFromEnd < onEndReachedThreshold * scrollLength) {
      state.isEndReached = true;
      onEndReached({ distanceFromEnd });
    }
  }
};

export const handleScrollDebounced = <TData>(state: InternalState<TData>) => {
  calculateItemsInView(state);
  checkAtBottom(state);

  // Reset to debounce
  state.animFrameScroll = null;
};

export const handleScroll = <TData>(
  state: InternalState<TData>,
  onScrollDebounced: () => void,
  event: {
    nativeEvent: NativeScrollEvent;
  },
) => {
  // in some cases when we set ScrollView contentOffset prop, there comes event from with 0 height and width
  // this causes blank list display, looks to be Paper implementation problem
  // let's filter out such events
  if (event.nativeEvent.contentSize.height === 0 && event.nativeEvent.contentSize.width === 0) {
    return;
  }
  const { horizontal, onScroll } = state.props;
  state.hasScrolled = true;
  const newScroll = event.nativeEvent.contentOffset[horizontal ? 'x' : 'y'];
  // Update the scroll position to use in checks
  state.scrollPrevious = state.scroll;
  state.scroll = newScroll;

  // Debounce a calculate if no calculate is already pending
  if (!state.animFrameScroll) {
    state.animFrameScroll = requestAnimationFrame(onScrollDebounced);
  }

  onScroll?.(event as NativeSyntheticEvent<NativeScrollEvent>);
};

export const onLayout = <TData>(state: InternalState<TData>, event: LayoutChangeEvent) => {
  state.scrollLength = event.nativeEvent.layout[state.props.horizontal ? 'width' : 'height'];
};
