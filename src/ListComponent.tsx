import { type ReactNode, useMemo } from "react";
import * as React from "react";
import {
    Animated,
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    ScrollView,
    type ScrollViewProps,
    View,
} from "react-native";
import { $View } from "./$View";
import { Containers } from "./Containers";
import { peek$, set$, useStateContext } from "./state";
import type { LegendListProps } from "./types";

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
    refScrollView: React.Ref<ScrollView>;
    getRenderedItem: (key: string) => { index: number; renderedItem: ReactNode } | null;
    updateItemSize: (containerId: number, itemKey: string, size: number) => void;
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onLayout: (event: LayoutChangeEvent) => void;
    maintainVisibleContentPosition: boolean;
    renderScrollComponent?: (props: ScrollViewProps) => React.ReactElement<ScrollViewProps>;
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
    waitForInitialLayout,
    handleScroll,
    onLayout,
    ListHeaderComponent,
    ListHeaderComponentStyle,
    ListFooterComponent,
    ListFooterComponentStyle,
    ListEmptyComponent,
    getRenderedItem,
    updateItemSize,
    refScrollView,
    maintainVisibleContentPosition,
    renderScrollComponent,
    ...rest
}: ListComponentProps) {
    const ctx = useStateContext();

    // Use renderScrollComponent if provided, otherwise a regular ScrollView
    const ScrollComponent = renderScrollComponent
        ? useMemo(
              () => React.forwardRef((props, ref) => renderScrollComponent({ ...props, ref } as any)),
              [renderScrollComponent],
          )
        : ScrollView;

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

    return (
        <ScrollComponent
            {...rest}
            style={style}
            maintainVisibleContentPosition={
                maintainVisibleContentPosition && !ListEmptyComponent ? { minIndexForVisible: 0 } : undefined
            }
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
            ref={refScrollView as any}
        >
            <$View
                $key={"paddingTop"}
                $key2="scrollAdjust"
                $style={() => {
                    const paddingTop = peek$<number>(ctx, "paddingTop");
                    const scrollAdjust = peek$<number>(ctx, "scrollAdjust");
                    return { marginTop: scrollAdjust, paddingTop: paddingTop };
                }}
            />

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
            {ListEmptyComponent && getComponent(ListEmptyComponent)}

            <Containers
                horizontal={horizontal!}
                recycleItems={recycleItems!}
                waitForInitialLayout={waitForInitialLayout}
                getRenderedItem={getRenderedItem}
                ItemSeparatorComponent={ItemSeparatorComponent && getComponent(ItemSeparatorComponent)}
                updateItemSize={updateItemSize}
            />
            {ListFooterComponent && <View style={ListFooterComponentStyle}>{getComponent(ListFooterComponent)}</View>}
        </ScrollComponent>
    );
});
