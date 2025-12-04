import * as React from "react";
import { useMemo } from "react";
import type {
    Animated,
    LayoutChangeEvent,
    LayoutRectangle,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    ScrollViewProps,
    ViewStyle,
} from "react-native";

import { Containers } from "@/components/Containers";
import { DevNumbers } from "@/components/DevNumbers";
import { ListComponentScrollView } from "@/components/ListComponentScrollView";
import { Padding, PaddingDevMode } from "@/components/Padding";
import { ScrollAdjust } from "@/components/ScrollAdjust";
import { SnapWrapper } from "@/components/SnapWrapper";
import { ENABLE_DEVMODE } from "@/constants";
import type { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import { LayoutView } from "@/platform/LayoutView";
import { set$, useStateContext } from "@/state/state";
import { type GetRenderedItem, type LegendListProps, typedMemo } from "@/types";
import { IS_DEV } from "@/utils/devEnvironment";

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
    stickyHeaderIndices: number[] | undefined;
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

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
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
    stickyHeaderIndices,
    ...rest
}: ListComponentProps<ItemT>) {
    const ctx = useStateContext();

    // Use renderScrollComponent if provided, otherwise a regular ScrollView
    const ScrollComponent = renderScrollComponent
        ? useMemo(
              () => React.forwardRef((props: ScrollViewProps, ref) => renderScrollComponent!({ ...props, ref } as any)),
              [renderScrollComponent],
          )
        : ListComponentScrollView;

    React.useEffect(() => {
        if (canRender) {
            setTimeout(() => {
                scrollAdjustHandler.setMounted();
            }, 0);
        }
    }, [canRender]);

    const SnapOrScroll = snapToIndices ? SnapWrapper : (ScrollComponent as typeof Animated.ScrollView);

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
            <ScrollAdjust />
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
            {IS_DEV && ENABLE_DEVMODE && <DevNumbers />}
        </SnapOrScroll>
    );
});
