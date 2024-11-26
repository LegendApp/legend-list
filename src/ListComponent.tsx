import { ComponentType, isValidElement, ReactElement, ReactNode } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { $View } from './$View';
import { Containers } from './Containers';
import { peek$, set$, useStateContext } from './state';
import type { LegendListProps } from './types';

interface ListComponentProps<TData>
  extends Omit<
    LegendListProps<TData>,
    'data' | 'estimatedItemSize' | 'drawDistance' | 'maintainScrollAtEnd' | 'maintainScrollAtEndThreshold'
  > {
  style: StyleProp<ViewStyle>;
  contentContainerStyle: StyleProp<ViewStyle>;
  horizontal: boolean;
  initialContentOffset: number | undefined;
  refScroller: React.MutableRefObject<ScrollView>;
  getRenderedItem: (index: number) => ReactNode;
  updateItemSize: (index: number, length: number) => void;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  addTotalLength: (totalLength: number) => void;
}

const getComponent = <P,>(Component: ComponentType<object> | ReactElement<P>) => {
  if (isValidElement<P>(Component)) {
    return Component;
  }
  return <Component />;
};

export const ListComponent = <TData,>(props: ListComponentProps<TData>) => {
  const {
    style,
    contentContainerStyle,
    horizontal,
    initialContentOffset,
    recycleItems = false,
    ItemSeparatorComponent,
    alignItemsAtEnd,
    handleScroll,
    onLayout,
    ListHeaderComponent,
    ListHeaderComponentStyle,
    ListFooterComponent,
    ListFooterComponentStyle,
    getRenderedItem,
    updateItemSize,
    addTotalLength,
    refScroller,
    ...rest
  } = props;
  const ctx = useStateContext();

  return (
    <ScrollView
      {...rest}
      contentContainerStyle={[
        contentContainerStyle,
        horizontal
          ? {
              height: '100%',
            }
          : {},
      ]}
      contentOffset={
        initialContentOffset
          ? horizontal
            ? { x: initialContentOffset, y: 0 }
            : { x: 0, y: initialContentOffset }
          : undefined
      }
      horizontal={horizontal}
      onLayout={onLayout}
      onScroll={handleScroll}
      ref={refScroller}
      style={style}
    >
      {alignItemsAtEnd && <$View $key="paddingTop" $style={() => ({ height: peek$(ctx, 'paddingTop') })} />}
      {ListHeaderComponent && (
        <View
          onLayout={(event) => {
            const size = event.nativeEvent.layout[horizontal ? 'width' : 'height'];
            const prevSize = peek$(ctx, 'headerSize') ?? 0;
            if (size !== prevSize) {
              set$(ctx, 'headerSize', size);
              addTotalLength(size - prevSize);
            }
          }}
          style={ListHeaderComponentStyle}
        >
          {getComponent(ListHeaderComponent)}
        </View>
      )}
      {/* {supportsEstimationAdjustment && (
                <Reactive.View
                    $style={() => ({
                        height: visibleRange$.topPad.get(),
                        width: '100%',
                    })}
                />
            )} */}

      <Containers
        ItemSeparatorComponent={ItemSeparatorComponent && getComponent(ItemSeparatorComponent)}
        getRenderedItem={getRenderedItem}
        horizontal={horizontal}
        recycleItems={recycleItems}
        updateItemSize={updateItemSize}
      />
      {ListFooterComponent && (
        <View
          onLayout={(event) => {
            const size = event.nativeEvent.layout[horizontal ? 'width' : 'height'];
            const prevSize = peek$(ctx, 'footerSize') ?? 0;
            if (size !== prevSize) {
              set$(ctx, 'footerSize', size);
              addTotalLength(size - prevSize);
            }
          }}
          style={ListFooterComponentStyle}
        >
          {getComponent(ListFooterComponent)}
        </View>
      )}
    </ScrollView>
  );
};
