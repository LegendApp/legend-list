import * as React from "react";
import { useCallback, useLayoutEffect, useMemo } from "react";

import { Containers } from "@/components/Containers";
import { DevNumbers } from "@/components/DevNumbers";
import { ListComponentScrollView } from "@/components/ListComponentScrollView";
import { ScrollAdjust } from "@/components/ScrollAdjust";
import { SnapWrapper } from "@/components/SnapWrapper";
import { ENABLE_DEVMODE } from "@/constants";
import type { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import { LayoutView } from "@/platform/LayoutView";
import type {
    LayoutChangeEvent,
    LayoutRectangle,
    LooseScrollView,
    LooseScrollViewProps,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ViewStyle,
} from "@/platform/scrollview-types";
import { set$, useStateContext } from "@/state/state";
import { type GetRenderedItem, type LegendListPropsBase, typedMemo } from "@/types.internal";
import { IS_DEV } from "@/utils/devEnvironment";
import { getComponent } from "@/utils/getComponent";

interface ListComponentProps<ItemT>
    extends Omit<
        LegendListPropsBase<ItemT, LooseScrollViewProps> & { scrollEventThrottle: number | undefined },
        | "data"
        | "estimatedItemSize"
        | "drawDistance"
        | "maintainScrollAtEnd"
        | "maintainScrollAtEndThreshold"
        | "maintainVisibleContentPosition"
        | "refScrollView"
        | "renderScrollComponent"
        | "style"
    > {
    horizontal: boolean;
    initialContentOffset: number | undefined;
    refScrollView: React.Ref<LooseScrollView | null>;
    getRenderedItem: GetRenderedItem;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onLayout: (event: LayoutChangeEvent) => void;
    onLayoutFooter?: (rect: LayoutRectangle, fromLayoutEffect: boolean) => void;
    renderScrollComponent?: (props: LooseScrollViewProps) => React.ReactElement | null;
    style: ViewStyle;
    canRender: boolean;
    scrollAdjustHandler: ScrollAdjustHandler;
    snapToIndices: number[] | undefined;
    stickyHeaderIndices: number[] | undefined;
    useWindowScroll?: boolean;
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const ListComponent = typedMemo(function ListComponent<ItemT>({
    canRender,
    style,
    contentContainerStyle,
    horizontal,
    initialContentOffset,
    recycleItems,
    ItemSeparatorComponent,
    alignItemsAtEnd: _alignItemsAtEnd,
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
    renderScrollComponent,
    onLayoutFooter,
    scrollAdjustHandler,
    snapToIndices,
    stickyHeaderConfig,
    stickyHeaderIndices,
    useWindowScroll = false,
    ...rest
}: ListComponentProps<ItemT>) {
    const ctx = useStateContext();
    const maintainVisibleContentPosition = ctx.state.props.maintainVisibleContentPosition;

    // Use renderScrollComponent if provided, otherwise a regular ScrollView
    const ScrollComponent = useMemo(() => {
        if (!renderScrollComponent) {
            return ListComponentScrollView;
        }

        return React.forwardRef((props: LooseScrollViewProps, ref) =>
            renderScrollComponent({ ...props, ref } as LooseScrollViewProps),
        );
    }, [renderScrollComponent]);

    const SnapOrScroll: React.ComponentType<any> = snapToIndices
        ? SnapWrapper
        : (ScrollComponent as React.ComponentType<any>);

    useLayoutEffect(() => {
        // Handle header/footer getting toggled on and off, remove header/footer size when they are not present
        if (!ListHeaderComponent) {
            set$(ctx, "headerSize", 0);
        }
        if (!ListFooterComponent) {
            set$(ctx, "footerSize", 0);
        }
    }, [ListHeaderComponent, ListFooterComponent, ctx]);

    const onLayoutHeader = useCallback(
        (rect: LayoutRectangle) => {
            const size = rect[horizontal ? "width" : "height"];
            set$(ctx, "headerSize", size);
        },
        [ctx, horizontal],
    );

    const onLayoutFooterInternal = useCallback(
        (rect: LayoutRectangle, fromLayoutEffect: boolean) => {
            const size = rect[horizontal ? "width" : "height"];
            set$(ctx, "footerSize", size);
            onLayoutFooter?.(rect, fromLayoutEffect);
        },
        [ctx, horizontal, onLayoutFooter],
    );

    return (
        <SnapOrScroll
            {...rest}
            {...(ScrollComponent === ListComponentScrollView ? { useWindowScroll } : {})}
            contentContainerStyle={[
                contentContainerStyle,
                horizontal
                    ? {
                          height: "100%",
                      }
                    : {},
            ]}
            contentOffset={
                initialContentOffset !== undefined
                    ? horizontal
                        ? { x: initialContentOffset, y: 0 }
                        : { x: 0, y: initialContentOffset }
                    : undefined
            }
            horizontal={horizontal}
            maintainVisibleContentPosition={
                maintainVisibleContentPosition.size || maintainVisibleContentPosition.data
                    ? { minIndexForVisible: 0 }
                    : undefined
            }
            onLayout={onLayout}
            onScroll={onScroll}
            ref={refScrollView as any}
            ScrollComponent={snapToIndices ? ScrollComponent : (undefined as any)}
            style={style}
        >
            <ScrollAdjust />
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
                />
            )}
            {ListFooterComponent && (
                <LayoutView onLayoutChange={onLayoutFooterInternal} style={ListFooterComponentStyle}>
                    {getComponent(ListFooterComponent)}
                </LayoutView>
            )}
            {IS_DEV && ENABLE_DEVMODE && <DevNumbers />}
        </SnapOrScroll>
    );
});
