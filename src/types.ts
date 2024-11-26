import type { ComponentProps, ComponentType, ReactElement, ReactNode } from 'react';
import type { DimensionValue, ScrollView, StyleProp, ViewStyle, ViewToken } from 'react-native';

export type LegendListProps<TData> = Omit<ComponentProps<typeof ScrollView>, 'contentOffset'> & {
  data: TData[];
  initialScrollOffset?: number;
  initialScrollIndex?: number;
  drawDistance?: number;
  initialNumContainers?: number;
  recycleItems?: boolean;
  onEndReachedThreshold?: number | null | undefined;
  maintainScrollAtEnd?: boolean;
  maintainScrollAtEndThreshold?: number;
  alignItemsAtEnd?: boolean;
  // in most cases providing a constant value for item size enough
  estimatedItemSize: number;
  // in case you have distinct item sizes, you can provide a function to get the size of an item
  // use instead of FlatList's getItemLayout or FlashList overrideItemLayout
  // if you want to have accurate initialScrollOffset, you should provide this function
  getEstimatedItemSize?: (index: number, item: TData) => number;
  onEndReached?: ((info: { distanceFromEnd: number }) => void) | null | undefined;
  keyExtractor?: (item: TData, index: number) => string;
  renderItem?: (props: LegendListRenderItemInfo<TData>) => ReactNode;
  onViewableRangeChanged?: (range: ViewableRange<TData>) => void;
  ListHeaderComponent?: ComponentType | ReactElement | null | undefined;
  ListHeaderComponentStyle?: StyleProp<ViewStyle> | undefined;
  ListFooterComponent?: ComponentType | ReactElement | null | undefined;
  ListFooterComponentStyle?: StyleProp<ViewStyle> | undefined;
  ItemSeparatorComponent?: ComponentType;
  //   TODO:
  onViewableItemsChanged?:
    | ((info: { viewableItems: ViewToken<TData>[]; changed: ViewToken<TData>[] }) => void)
    | null
    | undefined;
};

export interface LegendListPropsDefaulted<TData> extends LegendListProps<TData> {
  recycleItems: boolean;
  onEndReachedThreshold: number;
  maintainScrollAtEndThreshold: number;
  maintainScrollAtEnd: boolean;
  alignItemsAtEnd: boolean;
}

export interface ViewableRange<T> {
  startBuffered: number;
  start: number;
  endBuffered: number;
  end: number;
  items: T[];
}

export interface LegendListRenderItemInfo<ItemT> {
  item: ItemT;
  index: number;
}

export interface StateValues {
  numContainers: number;
  [containerIndex: `containerIndex${number}`]: number;
  [position: `containerPosition${number}`]: number;
  numItems: number;
  totalLength: number;
  paddingTop: number;
  stylePaddingTop: DimensionValue;
  headerSize: number;
  footerSize: number;
}

// Internal type after this line
export type StateType = keyof StateValues;

export interface StateContext {
  listeners: Map<StateType, () => void>;
  values: Partial<StateValues>;
}

export interface InternalState<TData> {
  positions: Map<string, number>;
  lengths: Map<string, number>;
  pendingAdjust: number;
  animFrameScroll: number | null;
  animFrameLayout: number | null;
  isStartReached: boolean;
  isEndReached: boolean;
  isAtBottom: boolean;
  idsInFirstRender: Set<string>;
  hasScrolled: boolean;
  scrollLength: number;
  startBuffered: number;
  startNoBuffer: number;
  endBuffered: number;
  endNoBuffer: number;
  scrollPrevious: number;
  scroll: number;
  previousViewableItems: Set<number>;
  scrollBuffer: number;
  props: LegendListPropsDefaulted<TData>;
  ctx: StateContext;
}
