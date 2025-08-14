// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";

import { Container } from "@/components/Container";
import { IsNewArchitecture } from "@/constants";
import { useDOMOrder } from "@/hooks/useDOMOrder";
import { useValue$ } from "@/hooks/useValue$";
import { AnimatedView } from "@/platform/AnimatedComponents";
import { Platform } from "@/platform/Platform";
import type { StyleProp, ViewStyle } from "@/platform/View";
import { useArr$, useStateContext } from "@/state/state";
import { type GetRenderedItem, typedMemo } from "@/types";

interface ContainersProps<ItemT> {
    horizontal: boolean;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
    waitForInitialLayout: boolean | undefined;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    getRenderedItem: GetRenderedItem;
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

    // Initialize DOM reordering hook - noop in react namtive
    useDOMOrder();

    const [numContainers, numColumns] = useArr$(["numContainersPooled", "numColumns"]);
    const animSize = useValue$("totalSize", {
        // On web, expand immediately to avoid visible blanks at high scroll velocities.
        // On native, coalesce small increases to reduce layout churn.
        delay: (value, prevValue) => (Platform.OS === "web" ? 0 : !prevValue || value - prevValue > 20 ? 0 : 200),
    });
    const animOpacity =
        waitForInitialLayout && !IsNewArchitecture
            ? useValue$("containersDidLayout", { getValue: (value) => (value ? 1 : 0) })
            : undefined;
    const otherAxisSize = useValue$("otherAxisSize", { delay: 0 });

    const containers: React.ReactNode[] = [];
    for (let i = 0; i < numContainers; i++) {
        containers.push(
            <Container
                getRenderedItem={getRenderedItem}
                horizontal={horizontal}
                ItemSeparatorComponent={ItemSeparatorComponent}
                id={i}
                key={i}
                recycleItems={recycleItems}
                // specifying inline separator makes Containers rerender on each data change
                // should we do memo of ItemSeparatorComponent?
                updateItemSize={updateItemSize}
            />,
        );
    }

    const style: StyleProp<ViewStyle> = horizontal
        ? { minHeight: otherAxisSize, opacity: animOpacity, width: animSize }
        : { height: animSize, minWidth: otherAxisSize, opacity: animOpacity };

    if (columnWrapperStyle && numColumns > 1) {
        // Extract gap properties from columnWrapperStyle if available
        const { columnGap, rowGap, gap } = columnWrapperStyle;

        const gapX = columnGap || gap || 0;
        const gapY = rowGap || gap || 0;
        if (horizontal) {
            if (gapY) {
                style.marginVertical = -gapY / 2;
            }
            if (gapX) {
                style.marginRight = -gapX;
            }
        } else {
            if (gapX) {
                style.marginHorizontal = -gapX;
            }
            if (gapY) {
                style.marginBottom = -gapY;
            }
        }
    }

    return <AnimatedView style={style}>{containers}</AnimatedView>;
});
