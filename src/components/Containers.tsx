// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useRef } from "react";

import { ContainerSlot } from "@/components/ContainerSlot";
import { useDOMOrder } from "@/hooks/useDOMOrder";
import { useArr$, useStateContext } from "@/state/state";
import type { StickyHeaderConfig } from "@/types.base";
import { type GetRenderedItem, typedMemo } from "@/types.internal";
import { isHorizontalRTL } from "@/utils/rtl";

interface ContainersProps<ItemT> {
    horizontal: boolean;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    getRenderedItem: GetRenderedItem;
    stickyHeaderConfig?: StickyHeaderConfig;
}

interface ContainersInnerProps {
    horizontal: boolean;
    numColumns: number;
    children: React.ReactNode;
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const ContainersInner = typedMemo(function ContainersInner({ horizontal, numColumns, children }: ContainersInnerProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    const ctx = useStateContext();
    const columnWrapperStyle = ctx.columnWrapperStyle;
    const isHorizontalRTLList = isHorizontalRTL(ctx.state);
    const [otherAxisSize, readyToRender, totalSize] = useArr$(["otherAxisSize", "readyToRender", "totalSize"]);

    // Initialize DOM reordering hook - noop in react namtive
    useDOMOrder(ref);

    const style: React.CSSProperties = horizontal
        ? {
              direction: isHorizontalRTLList ? "ltr" : undefined,
              minHeight: otherAxisSize,
              opacity: readyToRender ? 1 : 0,
              position: "relative",
              width: totalSize,
          }
        : { height: totalSize, minWidth: otherAxisSize, opacity: readyToRender ? 1 : 0, position: "relative" };

    if (!readyToRender) {
        style.pointerEvents = "none";
    }

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
    updateItemSize,
    getRenderedItem,
    stickyHeaderConfig,
}: ContainersProps<ItemT>) {
    const [numContainersPooled, numColumns] = useArr$(["numContainersPooled", "numColumns"]);

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

    return (
        <ContainersInner horizontal={horizontal} numColumns={numColumns}>
            {containers}
        </ContainersInner>
    );
});
