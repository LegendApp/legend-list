import { ForwardedRef, forwardRef, JSX, MutableRefObject, useMemo, useRef } from 'react';
import { Dimensions, LayoutChangeEvent, NativeScrollEvent, ScrollView, StyleSheet } from 'react-native';
import { DEFAULT_SCROLL_BUFFER } from './constants';
import {
  allocateContainers,
  applyDefaultProps,
  calculateInitialOffset,
  calculateItemsInView,
  checkAtBottom,
  getId,
  getItemSize,
  getRenderedItem,
  handleScrollDebounced,
  handleScroll,
  onLayout,
  addTotalLength,
  updateItemSize,
} from './LegendListHelpers';
import { ListComponent } from './ListComponent';
import { peek$, set$, StateProvider, useStateContext } from './state';
import type { InternalState, LegendListProps } from './types';

export const LegendList = forwardRef(function LegendList<TData>(
  props: LegendListProps<TData>,
  forwardedRef: ForwardedRef<ScrollView>,
) {
  return (
    <StateProvider>
      <LegendListInner<TData> {...props} ref={forwardedRef} />
    </StateProvider>
  );
});

const LegendListInner = forwardRef(function LegendListInner<TData>(
  props_: LegendListProps<TData>,
  forwardedRef: ForwardedRef<ScrollView>,
) {
  const { keyExtractor } = props_;
  const props = applyDefaultProps(props_);
  const {
    data,
    initialScrollOffset,
    horizontal,
    style: styleProp,
    contentContainerStyle: contentContainerStyleProp,
    drawDistance,
    ...rest
  } = props;

  const ctx = useStateContext();

  const refScroller = (forwardedRef ?? useRef<ScrollView>(null)) as MutableRefObject<ScrollView>;
  const scrollBuffer = drawDistance ?? DEFAULT_SCROLL_BUFFER;
  // Experimental: It works ok on iOS when scrolling up, but is doing weird things when sizes are changing.
  // And it doesn't work at all on Android because it uses contentInset. I'll try it again later.
  // Ideally it would work by adjusting the contentOffset but in previous attempts that was causing jitter.
  // const supportsEstimationAdjustment = false; //   Platform.OS === "ios";

  const initialContentOffset = initialScrollOffset ?? useMemo(() => calculateInitialOffset(props), []);

  const refState = useRef<InternalState<TData>>({
    lengths: new Map(),
    positions: new Map(),
    pendingAdjust: 0,
    animFrameScroll: null,
    animFrameLayout: null,
    isStartReached: false,
    isEndReached: false,
    isAtBottom: false,
    idsInFirstRender: new Set(data.map((_, i) => getId({ keyExtractor, data }, i))),
    hasScrolled: false,
    scrollLength: Dimensions.get('window')[horizontal ? 'width' : 'height'],
    startBuffered: 0,
    startNoBuffer: 0,
    endBuffered: 0,
    endNoBuffer: 0,
    scroll: initialContentOffset ?? 0,
    scrollPrevious: initialContentOffset ?? 0,
    previousViewableItems: new Set(),
    props,
    ctx,
    scrollBuffer,
  });
  refState.current.props = props;
  refState.current.ctx = ctx;

  const styleFlattened = StyleSheet.flatten(styleProp);
  const style = useMemo(() => styleFlattened, [JSON.stringify(styleProp)]);
  const contentContainerStyleFlattened = StyleSheet.flatten(contentContainerStyleProp);
  const contentContainerStyle = useMemo(
    () => contentContainerStyleFlattened,
    [JSON.stringify(contentContainerStyleProp)],
  );

  // // Create functions that are bound to the state to avoid re-creating them on every render.
  // // This should be a minor optimization when data is changing often. And putting them elsewhere
  // // makes sure we always get the latest values from state and avoid accidentally using stale values.
  const getRenderedItemMemo = useRef((index: number) => getRenderedItem(refState.current.props, index)).current;
  const addTotalLengthMemo = useRef((totalLength: number) => {
    addTotalLength(refState.current, totalLength);
  }).current;
  const handleScrollDebouncedMemo = useRef(() => {
    handleScrollDebounced(refState.current);
  }).current;
  const handleScrollMemo = useRef((event: { nativeEvent: NativeScrollEvent }) => {
    handleScroll(refState.current, handleScrollDebouncedMemo, event);
  }).current;
  const onLayoutMemo = useRef((event: LayoutChangeEvent) => {
    onLayout(refState.current, event);
  }).current;
  const updateItemSizeMemo = useRef((index: number, length: number) => {
    updateItemSize(refState.current, refScroller, index, length);
  }).current;

  set$(ctx, `numItems`, data.length);
  // TODO: This needs to support horizontal and other ways of defining padding.
  set$(ctx, `stylePaddingTop`, styleFlattened.paddingTop ?? contentContainerStyleFlattened.paddingTop ?? 0);

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
    allocateContainers(refState.current);
    calculateItemsInView(refState.current);

    // Set an initial total height based on what we know
    const lengths = refState.current.lengths;
    let totalLength = (peek$(ctx, `headerSize`) ?? 0) + (peek$(ctx, `footerSize`) ?? 0);
    for (let i = 0; i < data.length; i++) {
      const id = getId(refState.current.props, i);
      totalLength += lengths.get(id) ?? getItemSize(refState.current, i, data[i]);
    }
    addTotalLength(refState.current, totalLength);
  }, []);

  useMemo(() => {
    refState.current.isEndReached = false;
    calculateItemsInView(refState.current);
    checkAtBottom(refState.current);
  }, [data]);

  return (
    <ListComponent<TData>
      {...rest}
      addTotalLength={addTotalLengthMemo}
      contentContainerStyle={contentContainerStyle}
      getRenderedItem={getRenderedItemMemo}
      handleScroll={handleScrollMemo}
      horizontal={horizontal ?? false}
      initialContentOffset={initialContentOffset}
      onLayout={onLayoutMemo}
      refScroller={refScroller}
      style={style}
      updateItemSize={updateItemSizeMemo}
    />
  );
}) as <TData>(props: LegendListProps<TData> & { ref?: ForwardedRef<ScrollView> }) => JSX.Element;
