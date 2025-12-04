import * as React from "react";
import { useMemo } from "react";
import {
    Animated,
    type LayoutChangeEvent,
    type LayoutRectangle,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    type ScrollView,
    type ScrollViewProps,
    Text,
    View,
    type ViewStyle,
} from "react-native";

import { Containers } from "@/components/Containers";
import { LayoutView } from "@/components/LayoutView";
import { ScrollAdjust } from "@/components/ScrollAdjust";
import { SnapWrapper } from "@/components/SnapWrapper";
import { ENABLE_DEVMODE } from "@/constants";
import type { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import { useValue$ } from "@/hooks/useValue$";
import { set$, useStateContext } from "@/state/state";
import { type GetRenderedItem, type LegendListProps, typedMemo } from "@/types";
import { getComponent } from "@/utils/getComponent";

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
    getRenderedItem: GetRenderedItem;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onLayout: (event: LayoutChangeEvent) => void;
    onLayoutHeader: (rect: LayoutRectangle, fromLayoutEffect: boolean) => void;
    maintainVisibleContentPosition: boolean;
    renderScrollComponent?: (props: ScrollViewProps) => React.ReactElement<ScrollViewProps>;
    style: ViewStyle;
    canRender: boolean;
    scrollAdjustHandler: ScrollAdjustHandler;
    snapToIndices: number[] | undefined;
    stickyIndices: number[] | undefined;
}

const Padding = () => {
    const animPaddingTop = useValue$("alignItemsPaddingTop", { delay: 0 });

    return <Animated.View style={{ paddingTop: animPaddingTop }} />;
};

const PaddingDevMode = () => {
    const animPaddingTop = useValue$("alignItemsPaddingTop", { delay: 0 });

    return (
        <>
            <Animated.View style={{ paddingTop: animPaddingTop }} />
            <Animated.View
                style={{
                    backgroundColor: "green",
                    height: animPaddingTop,
                    left: 0,
                    position: "absolute",
                    right: 0,
                    top: 0,
                }}
            />
        </>
    );
};

export const ListComponent = typedMemo(function ListComponent<ItemT>({
    canRender,
    style,
    contentContainerStyle,
    horizontal,
    initialContentOffset,
    recycleItems,
    ItemSeparatorComponent,
    alignItemsAtEnd,
    waitForInitialLayout,
    onScroll,
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
    scrollAdjustHandler,
    onLayoutHeader,
    snapToIndices,
    stickyIndices,
    stickyHeaderConfig,
    ...rest
}: ListComponentProps<ItemT>) {
    const ctx = useStateContext();

    // Use renderScrollComponent if provided, otherwise a regular ScrollView
    const ScrollComponent = renderScrollComponent
        ? useMemo(
              () => React.forwardRef((props, ref) => renderScrollComponent({ ...props, ref } as any)),
              [renderScrollComponent],
          )
        : Animated.ScrollView;

    React.useEffect(() => {
        if (canRender) {
            setTimeout(() => {
                scrollAdjustHandler.setMounted();
            }, 0);
        }
    }, [canRender]);

    const SnapOrScroll = snapToIndices ? SnapWrapper : ScrollComponent;

    return (
        <SnapOrScroll
            {...rest}
            contentContainerStyle={[
                contentContainerStyle,
                horizontal
                    ? {
                          height: "100%",
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
            maintainVisibleContentPosition={maintainVisibleContentPosition ? { minIndexForVisible: 0 } : undefined}
            onLayout={onLayout}
            onScroll={onScroll}
            ref={refScrollView as any}
            ScrollComponent={snapToIndices ? ScrollComponent : (undefined as any)}
            style={style}
        >
            {maintainVisibleContentPosition && <ScrollAdjust />}
            {ENABLE_DEVMODE ? <PaddingDevMode /> : <Padding />}
            {ListHeaderComponent && (
                <LayoutView onLayoutChange={onLayoutHeader} style={ListHeaderComponentStyle}>
                    {getComponent(ListHeaderComponent)}
                </LayoutView>
            )}
            {ListEmptyComponent && getComponent(ListEmptyComponent)}

            {canRender && !ListEmptyComponent && (
                <Containers
                    getRenderedItem={getRenderedItem}
                    horizontal={horizontal!}
                    ItemSeparatorComponent={ItemSeparatorComponent}
                    recycleItems={recycleItems!}
                    stickyHeaderConfig={stickyHeaderConfig}
                    updateItemSize={updateItemSize}
                    waitForInitialLayout={waitForInitialLayout}
                />
            )}
            {ListFooterComponent && (
                <LayoutView
                    onLayoutChange={(layout) => {
                        const size = layout[horizontal ? "width" : "height"];
                        set$(ctx, "footerSize", size);
                    }}
                    style={ListFooterComponentStyle}
                >
                    {getComponent(ListFooterComponent)}
                </LayoutView>
            )}
            {__DEV__ && ENABLE_DEVMODE && <DevNumbers />}
        </SnapOrScroll>
    );
});

const DevNumbers: React.FC =
    (__DEV__ as unknown as any) &&
    React.memo(function DevNumbers() {
        return Array.from({ length: 100 }).map((_, index) => (
            <View
                key={index}
                style={{
                    height: 100,
                    pointerEvents: "none",
                    position: "absolute",
                    top: index * 100,
                    width: "100%",
                }}
            >
                <Text style={{ color: "red" }}>{index * 100}</Text>
            </View>
        ));
    });
