// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { Animated, type ViewStyle } from "react-native";

import { ContainerLayoutCoordinator } from "@/components/ContainerLayoutCoordinator";
import { ContainerSlot } from "@/components/ContainerSlot";
import type { ContainersProps } from "@/components/Containers";
import { IsNewArchitecture } from "@/constants-platform";
import { useFreshDataTransitionVisibility } from "@/hooks/useFreshDataTransitionVisibility";
import { useValue$ } from "@/hooks/useValue$";
import { useArr$, useStateContext } from "@/state/state";
import { typedMemo } from "@/types.internal";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";

const isFabric = IsNewArchitecture;

// Match PositionView: on Fabric the committed minimum holds a shrinking content
// extent until row positions commit, while the Animated size grows it at once so
// end space set outside React (anchored end space) never outruns the content.
// Old architecture keeps both on the Animated update path.
const useCommittedMinSize = isFabric ? () => useArr$(["totalSize"])[0] : () => undefined;

interface ContainersLayerProps {
    children: React.ReactNode;
    contentRowGap?: number;
    footer?: React.ReactNode;
    freshDataTransitionEpoch: number;
    horizontal: boolean;
    renderRows: boolean;
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
const ContainersLayer = typedMemo(function ContainersLayer({
    children,
    contentRowGap,
    footer,
    freshDataTransitionEpoch,
    horizontal,
    renderRows,
}: ContainersLayerProps) {
    const ctx = useStateContext();
    const columnWrapperStyle = ctx.columnWrapperStyle;
    const animatedSize = useValue$("totalSize");
    const minSize = useCommittedMinSize();
    // Without end space set outside React, the committed size already lands with the row positions.
    // An attached Animated size would add a Fabric setNativeProps commit per change.
    const size = isFabric && !ctx.state.props.anchoredEndSpace ? minSize : animatedSize;
    const [readyToRender, numColumns, otherAxisSize = 0, footerSize = 0] = useArr$([
        "readyToRender",
        "numColumns",
        "otherAxisSize",
        "footerSize",
    ]);
    const showEstimatedItems = !!ctx.state.hasEstimatedInitialLayout && !hasActiveInitialScroll(ctx.state);
    const canShowItems = !!readyToRender || showEstimatedItems;
    const isVisible = useFreshDataTransitionVisibility(canShowItems, freshDataTransitionEpoch);

    const style: Animated.WithAnimatedValue<ViewStyle> = horizontal
        ? {
              height: otherAxisSize || "100%",
              minHeight: otherAxisSize,
              minWidth: minSize,
              transform: [{ translateY: isVisible ? 0 : -100000 }],
              width: size,
          }
        : {
              height: size,
              minHeight: minSize,
              minWidth: otherAxisSize,
              transform: [{ translateX: isVisible ? 0 : -100000 }],
          };

    const gapY = columnWrapperStyle?.rowGap || columnWrapperStyle?.gap || 0;
    if (columnWrapperStyle) {
        const gapX = columnWrapperStyle.columnGap || columnWrapperStyle.gap || 0;
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

    const layer = renderRows && (
        <Animated.View pointerEvents={isVisible ? undefined : "none"} style={style}>
            <ContainerLayoutCoordinator>{children}</ContainerLayoutCoordinator>
        </Animated.View>
    );
    const ContentExtent = isFabric && !horizontal ? ctx.state.props.contentExtentComponentInternal : undefined;

    if (ContentExtent) {
        const rowsExtent = renderRows ? Math.max(0, (minSize ?? 0) - gapY) : 0;
        const footerExtent = footer ? footerSize + (renderRows ? (contentRowGap ?? 0) : 0) : 0;
        return (
            <ContentExtent
                committedSize={rowsExtent + footerExtent}
                contentAlignItems={ctx.state.props.contentContainerAlignItems}
                contentRowGap={contentRowGap}
                footer={footer}
            >
                {layer}
            </ContentExtent>
        );
    }

    return layer;
});

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const Containers = typedMemo(function Containers<ItemT>({
    contentRowGap,
    footer,
    freshDataTransitionEpoch,
    horizontal,
    recycleItems,
    renderRows = true,
    ItemSeparatorComponent,
    stickyHeaderConfig,
    getRenderedItem,
}: ContainersProps<ItemT>) {
    const [numContainersPooled] = useArr$(["numContainersPooled"]);

    const containers: React.ReactNode[] = [];
    for (let i = 0; renderRows && i < numContainersPooled; i++) {
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

    return (
        <ContainersLayer
            contentRowGap={contentRowGap}
            footer={footer}
            freshDataTransitionEpoch={freshDataTransitionEpoch}
            horizontal={horizontal}
            renderRows={renderRows}
        >
            {containers}
        </ContainersLayer>
    );
});
