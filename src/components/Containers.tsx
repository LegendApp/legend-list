// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useRef } from "react";

import { Container } from "@/components/Container";
import { useDOMOrder } from "@/hooks/useDOMOrder";
import { Platform } from "@/platform/Platform";
import { useArr$, useStateContext } from "@/state/state";
import { type GetRenderedItem, type StickyHeaderConfig, typedMemo } from "@/types.base";

interface ContainersProps<ItemT> {
    horizontal: boolean;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
    waitForInitialLayout: boolean | undefined;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    getRenderedItem: GetRenderedItem;
    stickyHeaderConfig?: StickyHeaderConfig;
}

interface ContainersInnerProps {
    horizontal: boolean;
    numColumns: number;
    children: React.ReactNode;
    waitForInitialLayout: boolean | undefined;
}

function debugInitialEnd(event: string, payload: Record<string, unknown>) {
    if (Platform.OS !== "web") {
        return;
    }

    const debugState = ((globalThis as any).__legendInitialEndDebug ??= { seq: 0 }) as { seq: number };
    console.log(`${Date.now()} [debug-log bidirectional-initial-end initial-end-v2] ${event}`, {
        seq: ++debugState.seq,
        ...payload,
    });
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const ContainersInner = typedMemo(function ContainersInner({ horizontal, numColumns, children }: ContainersInnerProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    const ctx = useStateContext();
    const columnWrapperStyle = ctx.columnWrapperStyle;
    const [readyToRender, totalSize, otherAxisSize] = useArr$(["readyToRender", "totalSize", "otherAxisSize"]);
    const initialTarget = ctx.state?.initialScrollLastTarget ?? ctx.state?.initialScroll;
    const shouldHideForEndAlignedInitialScroll = !!(
        !readyToRender &&
        initialTarget &&
        initialTarget.viewPosition === 1 &&
        initialTarget.index !== undefined &&
        (
            ctx.state?.scrollingTo?.isInitialScroll ||
            ctx.state?.deferredPositions?.kind === "initial_scroll" ||
            !!ctx.state?.adjustingFromInitialMount
        )
    );

    if (initialTarget?.viewPosition === 1) {
        debugInitialEnd("containers-visibility", {
            adjustingFromInitialMount: ctx.state?.adjustingFromInitialMount,
            deferredKind: ctx.state?.deferredPositions?.kind,
            initialTarget,
            readyToRender,
            scrollingToInitialScroll: ctx.state?.scrollingTo?.isInitialScroll,
            shouldHideForEndAlignedInitialScroll,
        });
    }

    // Initialize DOM reordering hook - noop in react namtive
    useDOMOrder(ref);

    const style: React.CSSProperties = horizontal
        ? { minHeight: otherAxisSize, position: "relative", width: totalSize }
        : { height: totalSize, minWidth: otherAxisSize, position: "relative" };

    if (shouldHideForEndAlignedInitialScroll) {
        style.pointerEvents = "none";
        style.visibility = "hidden";
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
    stickyHeaderConfig,
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
                stickyHeaderConfig={stickyHeaderConfig}
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
