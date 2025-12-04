// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useRef } from "react";

import { Container } from "@/components/Container";
import { useDOMOrder } from "@/hooks/useDOMOrder";
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

interface ContainersInnerProps {
    horizontal: boolean;
    numColumns: number;
    children: React.ReactNode;
    waitForInitialLayout: boolean | undefined;
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const ContainersInner = typedMemo(function ContainersInner({ horizontal, numColumns, children }: ContainersInnerProps) {
    const ref = useRef<HTMLDivElement>(null);
    const ctx = useStateContext();
    const columnWrapperStyle = ctx.columnWrapperStyle;
    const [totalSize, otherAxisSize] = useArr$(["totalSize", "otherAxisSize"]);

    // Initialize DOM reordering hook - noop in react namtive
    useDOMOrder(ref);

    const style: React.CSSProperties = horizontal
        ? { minHeight: otherAxisSize, position: "relative", width: totalSize }
        : { height: totalSize, minWidth: otherAxisSize, position: "relative" };

    if (columnWrapperStyle && numColumns > 1) {
        // Extract gap properties from columnWrapperStyle if available
        const { columnGap, rowGap, gap } = columnWrapperStyle;

        const gapX = columnGap || gap || 0;
        const gapY = rowGap || gap || 0;
        if (horizontal) {
            if (gapY) {
                style.marginTop = style.marginBottom = -gapY / 2;
            }
            if (gapX) {
                style.marginRight = -gapX;
            }
        } else {
            if (gapX) {
                style.marginLeft = style.marginRight = -gapX;
            }
            if (gapY) {
                style.marginBottom = -gapY;
            }
        }
    }

    return (
        <div ref={ref} style={style}>
            {children}
        </div>
    );
});

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const Containers = typedMemo(function Containers<ItemT>({
    horizontal,
    recycleItems,
    ItemSeparatorComponent,
    waitForInitialLayout,
    updateItemSize,
    getRenderedItem,
}: ContainersProps<ItemT>) {
    const [numContainers, numColumns] = useArr$(["numContainersPooled", "numColumns"]);

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

    return (
        <ContainersInner horizontal={horizontal} numColumns={numColumns} waitForInitialLayout={waitForInitialLayout}>
            {containers}
        </ContainersInner>
    );
});
