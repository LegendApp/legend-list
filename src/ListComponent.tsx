import * as React from "react";
import type { ReactNode } from "react";
import {
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    ScrollView,
    type StyleProp,
    View,
    type ViewStyle,
} from "react-native";
import { $View } from "./$View";
import { Containers } from "./Containers";
import { peek$, set$, useStateContext } from "./state";
import type { LegendListProps } from "./types";

interface ListComponentProps
    extends Omit<
        LegendListProps<any>,
        "data" | "estimatedItemSize" | "drawDistance" | "maintainScrollAtEnd" | "maintainScrollAtEndThreshold"
    > {
    style: StyleProp<ViewStyle>;
    contentContainerStyle: StyleProp<ViewStyle>;
    horizontal: boolean;
    initialContentOffset: number | undefined;
    refScroller: React.MutableRefObject<ScrollView>;
    getRenderedItem: (key: string, containerId: number) => ReactNode;
    updateItemSize: (key: string, size: number) => void;
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onLayout: (event: LayoutChangeEvent) => void;
    addTotalSize: (size: number, index: number) => void;
}

const getComponent = (Component: React.ComponentType<any> | React.ReactElement) => {
    if (React.isValidElement<any>(Component)) {
        return Component;
    }
    if (Component) {
        return <Component />;
    }
    return null;
};

export const ListComponent = React.memo(function ListComponent({
    style,
    contentContainerStyle,
    horizontal,
    initialContentOffset,
    recycleItems,
    ItemSeparatorComponent,
    alignItemsAtEnd,
    handleScroll,
    onLayout,
    ListHeaderComponent,
    ListHeaderComponentStyle,
    ListFooterComponent,
    ListFooterComponentStyle,
    ListEmptyComponent,
    ListEmptyComponentStyle,
    getRenderedItem,
    updateItemSize,
    addTotalSize,
    refScroller,
    ...rest
}: ListComponentProps) {
    const ctx = useStateContext();

    return (
        <ScrollView
            {...rest}
            style={style}
            contentContainerStyle={[
                contentContainerStyle,
                horizontal
                    ? {
                          height: "100%",
                      }
                    : {},
            ]}
            // contentInset={{
            //     top: 200,
            // }}
            onScroll={handleScroll}
            onLayout={onLayout}
            scrollEventThrottle={32}
            horizontal={horizontal}
            contentOffset={
                initialContentOffset
                    ? horizontal
                        ? { x: initialContentOffset, y: 0 }
                        : { x: 0, y: initialContentOffset }
                    : undefined
            }
            ref={refScroller}
        >
            {alignItemsAtEnd && <$View $key="paddingTop" $style={() => ({ height: peek$(ctx, "paddingTop") })} />}
            {ListHeaderComponent && (
                <View
                    style={ListHeaderComponentStyle}
                    onLayout={(event) => {
                        const size = event.nativeEvent.layout[horizontal ? "width" : "height"];
                        const prevSize = peek$(ctx, "headerSize") || 0;
                        if (size !== prevSize) {
                            set$(ctx, "headerSize", size);
                            addTotalSize(size - prevSize, 0);
                        }
                    }}
                >
                    {getComponent(ListHeaderComponent)}
                </View>
            )}
            {ListEmptyComponent && <View style={ListEmptyComponentStyle}>{getComponent(ListEmptyComponent)}</View>}

            {/* {supportsEstimationAdjustment && (
                <Reactive.View
                    $style={() => ({
                        height: visibleRange$.topPad.get(),
                        width: '100%',
                    })}
                />
            )} */}

            <Containers
                horizontal={horizontal!}
                recycleItems={recycleItems!}
                getRenderedItem={getRenderedItem}
                ItemSeparatorComponent={ItemSeparatorComponent && getComponent(ItemSeparatorComponent)}
                updateItemSize={updateItemSize}
            />
            {ListFooterComponent && <View style={ListFooterComponentStyle}>{getComponent(ListFooterComponent)}</View>}
        </ScrollView>
    );
});
