// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { Animated, type ViewStyle } from "react-native";

import { ContainerLayoutCoordinator } from "@/components/ContainerLayoutCoordinator";
import { ContainerSlot } from "@/components/ContainerSlot";
import { useFreshDataTransitionVisibility } from "@/hooks/useFreshDataTransitionVisibility";
import { useValue$ } from "@/hooks/useValue$";
import { peek$, useArr$, useStateContext } from "@/state/state";
import type { StickyHeaderConfig } from "@/types.base";
import { type GetRenderedItem, typedMemo } from "@/types.internal";

interface ContainersProps<ItemT> {
    freshDataTransitionEpoch: number;
    horizontal: boolean;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
    getRenderedItem: GetRenderedItem;
    stickyHeaderConfig?: StickyHeaderConfig;
}

interface ContainersLayerProps {
    children: React.ReactNode;
    freshDataTransitionEpoch: number;
    horizontal: boolean;
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const ContainersLayer = typedMemo(function ContainersLayer({
    children,
    freshDataTransitionEpoch,
    horizontal,
}: ContainersLayerProps) {
    const ctx = useStateContext();
    const columnWrapperStyle = ctx.columnWrapperStyle;
    const animSize = useValue$("totalSize");
    const [readyToRender, numColumns, otherAxisSize = 0] = useArr$(["readyToRender", "numColumns", "otherAxisSize"]);
    const isVisible = useFreshDataTransitionVisibility(!!readyToRender, freshDataTransitionEpoch);

    const style: Animated.WithAnimatedValue<ViewStyle> = horizontal
        ? {
              height: otherAxisSize || "100%",
              minHeight: otherAxisSize,
              opacity: isVisible ? 1 : 0,
              width: animSize,
          }
        : { height: animSize, minWidth: otherAxisSize, opacity: isVisible ? 1 : 0 };

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

    return (
        <Animated.View pointerEvents={isVisible ? undefined : "none"} style={style}>
            <ContainerLayoutCoordinator>{children}</ContainerLayoutCoordinator>
        </Animated.View>
    );
});

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const Containers = typedMemo(function Containers<ItemT>({
    freshDataTransitionEpoch,
    horizontal,
    recycleItems,
    ItemSeparatorComponent,
    stickyHeaderConfig,
    getRenderedItem,
}: ContainersProps<ItemT>) {
    const ctx = useStateContext();
    // `lastPositionUpdate` is subscribed to purely to re-render when container assignments
    // change — the same signal the web DOM reordering in `useDOMOrder` listens to.
    const [numContainersPooled] = useArr$(["numContainersPooled", "lastPositionUpdate"]);

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
            />,
        );
    }

    // Render the children in the order of the items they hold. Containers are a recycled
    // pool, so their creation order stops matching the screen as soon as items reorder.
    // Position on screen comes from each container's own absolute offset, so this moves
    // nothing visually — but the native view order, and therefore the ACCESSIBILITY order,
    // is taken from child order, and a screen reader would otherwise walk a reordered list
    // in the wrong sequence. Web solves the same problem by sorting the DOM in `useDOMOrder`.
    //
    // Children are keyed by container id, so React reorders the existing elements rather
    // than remounting them, leaving recycling untouched.
    const containersInItemOrder = containers
        .map((container, i) => ({
            container,
            index: peek$(ctx, `containerItemIndex${i}`) ?? Number.MAX_SAFE_INTEGER,
        }))
        .sort((a, b) => a.index - b.index)
        .map(({ container }) => container);

    return (
        <ContainersLayer freshDataTransitionEpoch={freshDataTransitionEpoch} horizontal={horizontal}>
            {containersInItemOrder}
        </ContainersLayer>
    );
});
