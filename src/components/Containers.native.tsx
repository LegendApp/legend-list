// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { Animated, type ViewStyle } from "react-native";

import { ContainerSlot } from "@/components/ContainerSlot";
import { useValue$ } from "@/hooks/useValue$";
import { useArr$, useStateContext } from "@/state/state";
import type { StickyHeaderConfig } from "@/types.base";
import { type GetRenderedItem, typedMemo } from "@/types.internal";

interface ContainersProps<ItemT> {
    horizontal: boolean;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    getRenderedItem: GetRenderedItem;
    stickyHeaderConfig?: StickyHeaderConfig;
}

interface ContainersLayerProps {
    children: React.ReactNode;
    horizontal: boolean;
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const ContainersLayer = typedMemo(function ContainersLayer({ children, horizontal }: ContainersLayerProps) {
    const ctx = useStateContext();
    const columnWrapperStyle = ctx.columnWrapperStyle;
    const animSize = useValue$("totalSize");
    const [readyToRender, numColumns, otherAxisSize = 0] = useArr$(["readyToRender", "numColumns", "otherAxisSize"]);

    const style: Animated.WithAnimatedValue<ViewStyle> = horizontal
        ? {
              height: otherAxisSize || "100%",
              minHeight: otherAxisSize,
              opacity: readyToRender ? 1 : 0,
              width: animSize,
          }
        : { height: animSize, minWidth: otherAxisSize, opacity: readyToRender ? 1 : 0 };

    if (columnWrapperStyle) {
        // Extract gap properties from columnWrapperStyle if available
        const { columnGap, rowGap, gap } = columnWrapperStyle;

        const gapX = columnGap || gap || 0;
        const gapY = rowGap || gap || 0;
        if (horizontal) {
            if (gapY && numColumns > 1) {
                style.marginVertical = -gapY / 2;
            }
            if (gapX) {
                style.marginRight = -gapX;
            }
        } else {
            if (gapX && numColumns > 1) {
                style.marginHorizontal = -gapX;
            }
            if (gapY) {
                style.marginBottom = -gapY;
            }
        }
    }

    return <Animated.View style={style}>{children}</Animated.View>;
});

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const Containers = typedMemo(function Containers<ItemT>({
    horizontal,
    recycleItems,
    ItemSeparatorComponent,
    stickyHeaderConfig,
    updateItemSize,
    getRenderedItem,
}: ContainersProps<ItemT>) {
    const [numContainersPooled] = useArr$(["numContainersPooled"]);

    const containers: React.ReactNode[] = [];
    for (let i = 0; i < numContainersPooled; i++) {
        containers.push(
            <ContainerSlot
                getRenderedItem={getRenderedItem}
                horizontal={horizontal}
                ItemSeparatorComponent={ItemSeparatorComponent}
                id={i}
                key={i}
                recycleItems={recycleItems}
                // specifying inline separator makes Containers rerender on each data change
                // should we do memo of ItemSeparatorComponent?
                stickyHeaderConfig={stickyHeaderConfig}
                updateItemSize={updateItemSize}
            />,
        );
    }

    return <ContainersLayer horizontal={horizontal}>{containers}</ContainersLayer>;
});
