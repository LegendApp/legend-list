import * as React from "react";
import { useMemo } from "react";

import { Containers } from "@/components/Containers";
import { ScrollAdjust } from "@/components/ScrollAdjust";
import { SnapWrapper } from "@/components/SnapWrapper";
import { ENABLE_DEVMODE } from "@/constants";
import type { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import { useSyncLayout } from "@/hooks/useSyncLayout";
import { useValue$ } from "@/hooks/useValue$";
import { AnimatedScrollView, AnimatedView } from "@/platform/AnimatedComponents";
import type { LayoutChangeEvent, LayoutRectangle } from "@/platform/Layout";
import type { ScrollViewProps } from "@/platform/ScrollView";
// Intentionally not importing ScrollView types to avoid RN type conflicts on web
import { Text } from "@/platform/Text";
import { View, type ViewStyle } from "@/platform/View";
// Intentionally not importing ScrollView types to avoid RN type conflicts on web
import { set$, useStateContext } from "@/state/state";
import { type GetRenderedItem, type LegendListProps, typedMemo } from "@/types";

// Define the event types we need
export interface NativeScrollEvent {
    contentOffset: { x: number; y: number };
    contentSize: { width: number; height: number };
    layoutMeasurement: { width: number; height: number };
}

export interface NativeSyntheticEvent<T> {
    nativeEvent: T;
}

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
    refScrollView: React.Ref<any>;
    getRenderedItem: GetRenderedItem;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onLayout: (event: LayoutChangeEvent) => void;
    onLayoutHeader: (rect: LayoutRectangle, fromLayoutEffect: boolean) => void;
    maintainVisibleContentPosition: boolean;
    renderScrollComponent?: (props: any) => React.ReactElement<any>;
    style: ViewStyle;
    canRender: boolean;
    scrollAdjustHandler: ScrollAdjustHandler;
    snapToIndices: number[] | undefined;
    stickyIndices: number[] | undefined;
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

const Padding = () => {
    const animPaddingTop = useValue$("alignItemsPaddingTop", { delay: 0 });

    return <AnimatedView style={{ paddingTop: animPaddingTop }} />;
};

const PaddingDevMode = () => {
    const animPaddingTop = useValue$("alignItemsPaddingTop", { delay: 0 });

    return (
        <>
            <AnimatedView style={{ paddingTop: animPaddingTop }} />
            <AnimatedView
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
    ...rest
}: ListComponentProps<ItemT>) {
    const ctx = useStateContext();
    const { onLayout: onLayoutHeaderSync, ref: refHeader } = useSyncLayout({
        onChange: onLayoutHeader,
    });

    // Use renderScrollComponent if provided, otherwise a regular ScrollView
    const ScrollComponent = renderScrollComponent
        ? useMemo(
              () => React.forwardRef((props: ScrollViewProps, ref) => renderScrollComponent!({ ...props, ref } as any)),
              [renderScrollComponent],
          )
        : AnimatedScrollView;

    React.useEffect(() => {
        if (canRender) {
            setTimeout(() => {
                scrollAdjustHandler.setMounted();
            }, 0);
        }
    }, [canRender]);

    const SnapOrScroll = (snapToIndices ? SnapWrapper : ScrollComponent) as React.ComponentType<any>;

    // Web: styles are plain objects, not arrays. Build a simple object for contentContainerStyle.
    const contentContainerStyleWeb: ViewStyle | undefined = useMemo(() => {
        const base = (contentContainerStyle as ViewStyle) || undefined;
        if (!horizontal) return base;
        // Avoid creating a new object if not necessary to keep props stable
        if (base && (base as any).height === "100%") return base;
        return { ...(base || {}), height: "100%" } as ViewStyle;
    }, [horizontal, (contentContainerStyle as any)?.height === "100%" ? 1 : 0]);

    return (
        <SnapOrScroll
            {...rest}
            contentContainerStyle={contentContainerStyleWeb}
            contentOffset={
                initialContentOffset
                    ? horizontal
                        ? { x: initialContentOffset, y: 0 }
                        : { x: 0, y: initialContentOffset }
                    : undefined
            }
            horizontal={horizontal}
            maintainVisibleContentPosition={
                maintainVisibleContentPosition && !ListEmptyComponent ? { minIndexForVisible: 0 } : undefined
            }
            onLayout={onLayout}
            onScroll={onScroll}
            ref={refScrollView}
            ScrollComponent={snapToIndices ? (ScrollComponent as any) : undefined}
            style={style}
        >
            {maintainVisibleContentPosition && <ScrollAdjust />}
            {ENABLE_DEVMODE ? <PaddingDevMode /> : <Padding />}
            {ListHeaderComponent && (
                <View
                    observeLayout
                    onLayout={onLayoutHeaderSync}
                    ref={refHeader}
                    style={ListHeaderComponentStyle as ViewStyle}
                >
                    {getComponent(ListHeaderComponent)}
                </View>
            )}
            {ListEmptyComponent && getComponent(ListEmptyComponent)}

            {canRender && (
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
                <View
                    observeLayout
                    onLayout={(event) => {
                        const size = event.nativeEvent.layout[horizontal ? "width" : "height"];
                        set$(ctx, "footerSize", size);
                    }}
                    style={ListFooterComponentStyle as ViewStyle}
                >
                    {getComponent(ListFooterComponent)}
                </View>
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
