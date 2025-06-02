// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { Container } from "./Container";
import { useArr$, useStateContext } from "./state";
import { typedMemo } from "./types";
import { useValue$ } from "./useValue$";

interface ContainersProps<ItemT> {
    horizontal: boolean;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
    waitForInitialLayout: boolean | undefined;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    getRenderedItem: (key: string) => { index: number; item: ItemT; renderedItem: React.ReactNode } | null;
}

export const Containers = typedMemo(function Containers<ItemT>({
    horizontal,
    recycleItems,
    ItemSeparatorComponent,
    waitForInitialLayout,
    updateItemSize,
    getRenderedItem,
}: ContainersProps<ItemT>) {
    const ctx = useStateContext();
    const columnWrapperStyle = ctx.columnWrapperStyle;
    const [numContainers, numColumns] = useArr$(["numContainersPooled", "numColumns"]);
    const animSize = useValue$("totalSizeWithScrollAdjust", undefined, /*useMicrotask*/ true);
    const animOpacity = waitForInitialLayout ? useValue$("containersDidLayout", (value) => (value ? 1 : 0)) : undefined;
    const otherAxisSize = useValue$("otherAxisSize", undefined, /*useMicrotask*/ true);

    const containers: React.ReactNode[] = [];
    for (let i = 0; i < numContainers; i++) {
        containers.push(
            <Container
                id={i}
                key={i}
                recycleItems={recycleItems}
                horizontal={horizontal}
                getRenderedItem={getRenderedItem}
                updateItemSize={updateItemSize}
                // specifying inline separator makes Containers rerender on each data change
                // should we do memo of ItemSeparatorComponent?
                ItemSeparatorComponent={ItemSeparatorComponent}
            />,
        );
    }

    const style: StyleProp<ViewStyle> = horizontal
        ? { width: animSize, opacity: animOpacity, minHeight: otherAxisSize }
        : { height: animSize, opacity: animOpacity, minWidth: otherAxisSize };

    if (columnWrapperStyle && numColumns > 1) {
        // Extract gap properties from columnWrapperStyle if available
        const { columnGap, rowGap, gap } = columnWrapperStyle;
        if (horizontal) {
            const my = (rowGap || gap || 0) / 2;
            if (my) {
                style.marginVertical = -my;
            }
        } else {
            const mx = (columnGap || gap || 0) / 2;
            if (mx) {
                style.marginHorizontal = -mx;
            }
        }
    }

    return <Animated.View style={style}>{containers}</Animated.View>;
});
