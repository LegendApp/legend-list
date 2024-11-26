import { LayoutChangeEvent, ViewStyle } from 'react-native';
import { $View } from './$View';
import { peek$, use$, useStateContext } from './state';
import { Fragment, ReactNode } from 'react';

interface InnerContainerProps {
  id: number;
  getRenderedItem: (index: number) => ReactNode;
  recycleItems: boolean;
  ItemSeparatorComponent?: ReactNode;
}
const InnerContainer = (props: InnerContainerProps) => {
  const { id, getRenderedItem, recycleItems, ItemSeparatorComponent } = props;
  // Subscribe to the itemIndex so this re-renders when the itemIndex changes.
  const itemIndex = use$(`containerIndex${id}`);
  const numItems = ItemSeparatorComponent ? (use$('numItems') ?? 0) : 0;

  if (itemIndex == null || itemIndex < 0) {
    return null;
  }

  const renderedItem = getRenderedItem(itemIndex);

  return (
    <Fragment key={recycleItems ? undefined : itemIndex}>
      {renderedItem}
      {ItemSeparatorComponent && itemIndex < numItems - 1 && ItemSeparatorComponent}
    </Fragment>
  );
};

export const Container = ({
  id,
  recycleItems,
  horizontal,
  getRenderedItem,
  onLayout,
  ItemSeparatorComponent,
}: {
  id: number;
  recycleItems?: boolean;
  horizontal: boolean;
  getRenderedItem: (index: number) => React.ReactNode;
  onLayout: (index: number, length: number) => void;
  ItemSeparatorComponent?: React.ReactNode;
}) => {
  const ctx = useStateContext();

  const createStyle = (): ViewStyle => {
    const position = peek$(ctx, `containerPosition${id}`) ?? 0;
    return horizontal
      ? {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: position,
          opacity: position < 0 ? 0 : 1,
        }
      : {
          position: 'absolute',
          left: 0,
          right: 0,
          top: position,
          opacity: position < 0 ? 0 : 1,
        };
  };

  // Use a reactive View to ensure the container element itself
  // is not rendered when style changes, only the style prop.
  // This is a big perf boost to do less work rendering.
  return (
    <$View
      $key={`containerPosition${id}`}
      $style={createStyle}
      onLayout={(event: LayoutChangeEvent) => {
        const index = peek$(ctx, `containerIndex${id}`);
        if (index != null && index >= 0) {
          const length = Math.round(event.nativeEvent.layout[horizontal ? 'width' : 'height']);

          onLayout(index, length);
        }
      }}
    >
      <InnerContainer
        ItemSeparatorComponent={ItemSeparatorComponent}
        getRenderedItem={getRenderedItem}
        id={id}
        recycleItems={recycleItems ?? false}
      />
    </$View>
  );
};
