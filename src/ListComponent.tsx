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
    type ViewStyle,
} from "react-native";
import { Containers } from "./Containers";
import { ListHeaderComponentContainer } from "./ListHeaderComponentContainer";
import { ENABLE_DEVMODE } from "./constants";
import { set$, useStateContext } from "./state";
import { type LegendListProps, typedMemo } from "./types";
import { useValue$ } from "./useValue$";

interface ListComponentProps<ItemT>
    extends Omit<
        LegendListProps<ItemT> & { scrollEventThrottle: number | undefined },
        | "data"
        | "estimatedItemSize"
        | "drawDistance"
        | "maintainScrollAtEnd"
        | "maintainScrollAtEndThreshold"
        | "maintainVisibleContentPosition"
        | "style"
    > {
    horizontal: boolean;
    initialContentOffset: number | undefined;
    refScrollView: React.Ref<ScrollView>;
    getRenderedItem: (key: string) => { index: number; item: ItemT; renderedItem: ReactNode } | null;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onLayout: (event: LayoutChangeEvent) => void;
    maintainVisibleContentPosition: boolean;
    renderScrollComponent?: (props: ScrollViewProps) => React.ReactElement<ScrollViewProps>;
    style: ViewStyle;
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

const PaddingAndAdjust = () => {
    const animPaddingTop = useValue$("paddingTop", (v) => v, true);
    const animScrollAdjust = useValue$("scrollAdjust", (v) => v, true);

    const additionalSize = { marginTop: animScrollAdjust, paddingTop: animPaddingTop };
    return <Animated.View style={additionalSize} />;
};

const PaddingAndAdjustDevMode = () => {
    const animPaddingTop = useValue$("paddingTop", (v) => v, true);
    const animScrollAdjust = useValue$("scrollAdjust", (v) => v, true);

    return (
        <>
            <Animated.View style={{ marginTop: animScrollAdjust }} />
            <Animated.View style={{ paddingTop: animPaddingTop }} />
            <Animated.View
                style={{
                    position: "absolute",
                    top: Animated.add(animScrollAdjust, Animated.multiply(animScrollAdjust, -1)),
                    height: animPaddingTop,
                    left: 0,
                    right: 0,
                    backgroundColor: "green",
                }}
            />
            <Animated.View
                style={{
                    position: "absolute",
                    top: animPaddingTop,
                    height: animScrollAdjust,
                    left: -16,
                    right: -16,
                    backgroundColor: "lightblue",
                }}
            />
            <Animated.View
                style={{
                    position: "absolute",
                    top: animPaddingTop,
                    height: Animated.multiply(animScrollAdjust, -1),
                    width: 8,
                    right: 4,
                    borderStyle: "dashed",
                    borderColor: "blue",
                    borderWidth: 1,
                    backgroundColor: "lightblue",
                    //backgroundColor: "blue",
                }}
            />
        </>
    );
};

export const ListComponent = typedMemo(function ListComponent<ItemT>({
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
    ListEmptyComponentStyle,
    getRenderedItem,
    updateItemSize,
    refScrollView,
    maintainVisibleContentPosition,
    renderScrollComponent,
    onRefresh,
    refreshing,
    progressViewOffset,
    ...rest
}: ListComponentProps<ItemT>) {
    const ctx = useStateContext();

    // Use renderScrollComponent if provided, otherwise a regular ScrollView
    const ScrollComponent = renderScrollComponent
        ? useMemo(
              () => React.forwardRef((props, ref) => renderScrollComponent({ ...props, ref } as any)),
              [renderScrollComponent],
          )
        : ScrollView;

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
            {!ListEmptyComponent && (ENABLE_DEVMODE ? <PaddingAndAdjustDevMode /> : <PaddingAndAdjust />)}
            {ListHeaderComponent && (
                <ListHeaderComponentContainer
                    style={ListHeaderComponentStyle}
                    ctx={ctx}
                    horizontal={horizontal}
                    waitForInitialLayout={waitForInitialLayout}
                >
                    {getComponent(ListHeaderComponent)}
                </ListHeaderComponentContainer>
            )}
            {ListEmptyComponent && (
                <View
                    style={ListEmptyComponentStyle}
                    onLayout={(event) => {
                        const size = event.nativeEvent.layout[horizontal ? "width" : "height"];
                        set$(ctx, "emptySize", size);
                    }}
                >
                    {getComponent(ListEmptyComponent)}
                </View>
            )}

            <Containers
                horizontal={horizontal!}
                recycleItems={recycleItems!}
                waitForInitialLayout={waitForInitialLayout}
                getRenderedItem={getRenderedItem}
                ItemSeparatorComponent={ItemSeparatorComponent}
                updateItemSize={updateItemSize}
            />
            {ListFooterComponent && (
                <View
                    style={ListFooterComponentStyle}
                    onLayout={(event) => {
                        const size = event.nativeEvent.layout[horizontal ? "width" : "height"];
                        set$(ctx, "footerSize", size);
                    }}
                >
                    {getComponent(ListFooterComponent)}
                </View>
            )}
        </ScrollComponent>
    );
});
