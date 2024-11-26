import * as React from 'react';
import { $View } from './$View';
import { Container } from './Container';
import { peek$, use$, useStateContext } from './state';

interface ContainersProps {
  horizontal: boolean;
  recycleItems: boolean;
  ItemSeparatorComponent?: React.ReactNode;
  updateItemSize: (index: number, length: number) => void;
  getRenderedItem: (index: number) => React.ReactNode;
}

export const Containers = React.memo(function Containers({
  horizontal,
  recycleItems,
  ItemSeparatorComponent,
  updateItemSize,
  getRenderedItem,
}: ContainersProps) {
  const ctx = useStateContext();
  const numContainers = use$('numContainers') ?? 0;

  const containers = [];
  for (let i = 0; i < numContainers; i++) {
    containers.push(
      <Container
        ItemSeparatorComponent={ItemSeparatorComponent}
        getRenderedItem={getRenderedItem}
        horizontal={horizontal}
        id={i}
        key={i}
        onLayout={updateItemSize}
        recycleItems={recycleItems}
      />,
    );
  }

  return (
    <$View
      $key="totalLength"
      $style={() =>
        horizontal
          ? {
              width: peek$(ctx, 'totalLength'),
            }
          : {
              height: peek$(ctx, 'totalLength'),
            }
      }
    >
      {containers}
    </$View>
  );
});
