import { Observable } from '@legendapp/state';
import { enableReactNativeComponents } from '@legendapp/state/config/enableReactNativeComponents';
import * as React from 'react';
import { Reactive, use$ } from '@legendapp/state/react';
import { LayoutChangeEvent, View, ViewStyle } from 'react-native';
import type { LegendListProps } from './types';
import { ReactNode } from 'react';

enableReactNativeComponents();

export interface ContainerInfo {
    id: number;
    itemIndex: number;
    position: number;
}

export const Container = ({
    $container,
    recycleItems,
    listProps,
    reversed,
    getRenderedItem,
    onLayout,
}: {
    reversed?: boolean;
    $container: Observable<ContainerInfo>;
    recycleItems?: boolean;
    listProps: LegendListProps<any>;
    getRenderedItem: (index: number) => ReactNode;
    onLayout: (index: number, length: number) => void;
}) => {
    const { horizontal } = listProps;
    const { id } = $container.peek();
    // Subscribe to the itemIndex observable so this re-renders when the itemIndex changes.
    const itemIndex = use$($container.itemIndex);
    // Set a key on the child view if not recycling items so that it creates a new view
    // for the rendered item
    const key = recycleItems ? undefined : itemIndex;

    const createStyle = (): ViewStyle =>
        horizontal
            ? {
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: $container.position.get(),
                  opacity: $container.position.get() < 0 ? 0 : 1,
                  transform: reversed ? [{ scaleX: -1 }] : [],
              }
            : {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: $container.position.get(),
                  opacity: $container.position.get() < 0 ? 0 : 1,
                  transform: reversed ? [{ scaleY: -1 }] : [],
              };

    // Use Legend-State's Reactive.View to ensure the container element itself
    // is not rendered when style changes, only the style prop.
    // This is a big perf boost to do less work rendering.
    return itemIndex < 0 ? null : (
        <Reactive.View
            key={id}
            $style={createStyle}
            onLayout={(event: LayoutChangeEvent) => {
                const index = $container.itemIndex.peek();
                const length = Math.round(event.nativeEvent.layout[horizontal ? 'width' : 'height']);

                onLayout(index, length);
            }}
        >
            <View key={key}>{getRenderedItem(itemIndex)}</View>
        </Reactive.View>
    );
};
