import type { ReactNode } from "react";
import * as React from "react";
import {
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    type ScrollView,
    View,
} from "react-native";
import { $ScrollView } from "./$ScrollView";
import { $View } from "./$View";
import { Containers } from "./Containers";
import { peek$, set$, useStateContext } from "./state";
import type { LegendListProps } from "./types";

interface ListComponentProps
    extends Omit<
        LegendListProps<any>,
        "data" | "estimatedItemSize" | "drawDistance" | "maintainScrollAtEnd" | "maintainScrollAtEndThreshold"
    > {
    horizontal: boolean;
    initialContentOffset: number | undefined;
    refScroller: React.MutableRefObject<ScrollView>;
    getRenderedItem: (key: string, containerId: number) => ReactNode;
    updateItemSize: (key: string, size: number) => void;
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onLayout: (event: LayoutChangeEvent) => void;
    addTotalSize: (key: string | null, size: number) => void;
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
        <$ScrollView
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
                        const prevSize = peek$<number>(ctx, "headerSize") || 0;
                        if (size !== prevSize) {
                            set$(ctx, "headerSize", size);
                            addTotalSize(null, size - prevSize);
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
        </$ScrollView>
    );
});
