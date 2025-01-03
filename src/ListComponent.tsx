import type { ReactNode } from "react";
import * as React from "react";
import {
    Animated,
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    ScrollView,
    type ScrollView as ScrollViewType,
    View,
} from "react-native";

import { Containers } from "./Containers";
import { peek$, set$, useStateContext } from "./state";
import type { LegendListProps } from "./types";
import { useValue$ } from "./useValue$";

interface ListComponentProps
    extends Omit<
        LegendListProps<any>,
        | "data"
        | "estimatedItemSize"
        | "drawDistance"
        | "maintainScrollAtEnd"
        | "maintainScrollAtEndThreshold"
        | "maintainVisibleContentPosition"
    > {
    horizontal: boolean;
    initialContentOffset: number | undefined;
    refScroller: React.MutableRefObject<ScrollViewType>;
    getRenderedItem: (key: string, containerId: number) => ReactNode;
    updateItemSize: (containerId: number, itemKey: string, size: number) => void;
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onLayout: (event: LayoutChangeEvent) => void;
    maintainVisibleContentPosition: boolean;
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
    refScroller,
    maintainVisibleContentPosition,
    ...rest
}: ListComponentProps) {
    const ctx = useStateContext();
    const animPaddingTop = useValue$("paddingTop");
    const animScrollAdjust = useValue$("scrollAdjust");

    // TODO: Try this again? This had bad behaviorof sometimes setting the min size to greater than
    // the screen size
    // const style = React.useMemo(() => {
    //     const extraStyle: StyleProp<ViewStyle> = {};
    //     if (otherAxisSize > 0) {
    //         if (horizontal) {
    //             extraStyle.minHeight = otherAxisSize;
    //         } else {
    //             extraStyle.minWidth = otherAxisSize;
    //         }
    //     }
    //     console.log("style", StyleSheet.compose(extraStyle, styleProp) as StyleProp<ViewStyle>);
    //     return StyleSheet.compose(extraStyle, styleProp) as StyleProp<ViewStyle>;
    // }, [otherAxisSize]);

    const additionalSize = { marginTop: animScrollAdjust, paddingTop: animPaddingTop };

    return (
        <ScrollView
            {...rest}
            style={style}
            maintainVisibleContentPosition={maintainVisibleContentPosition ? { minIndexForVisible: 0 } : undefined}
            contentContainerStyle={[
                contentContainerStyle,
                horizontal
                    ? {
                          height: "100%",
                      }
                    : {},
            ]}
            onScroll={handleScroll}
            onLayout={onLayout}
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
            <Animated.View style={additionalSize} />
            {ListHeaderComponent && (
                <Animated.View
                    style={ListHeaderComponentStyle}
                    onLayout={(event) => {
                        const size = event.nativeEvent.layout[horizontal ? "width" : "height"];
                        const prevSize = peek$<number>(ctx, "headerSize") || 0;
                        if (size !== prevSize) {
                            set$(ctx, "headerSize", size);
                        }
                    }}
                >
                    {getComponent(ListHeaderComponent)}
                </Animated.View>
            )}
            {ListEmptyComponent && (
                <Animated.View style={ListEmptyComponentStyle}>
                    {getComponent(ListEmptyComponent)}
                </Animated.View>
            )}

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
