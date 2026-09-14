// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useMemo, useRef } from "react";

import { PositionView, PositionViewSticky } from "@/components/PositionView";
import { Separator } from "@/components/Separator";
import { useContainerMeasurement } from "@/hooks/useContainerMeasurement";
import { Platform } from "@/platform/Platform";
import type { DimensionValue, LooseView, StyleProp, ViewStyle } from "@/platform/scrollview-types";
import { ContextContainer, type ContextContainerType } from "@/state/ContextContainer";
import { useArr$, useStateContext } from "@/state/state";
import type { ColumnWrapperStyle, StickyHeaderConfig } from "@/types.base";
import { type GetRenderedItem, typedMemo } from "@/types.internal";
import { isHorizontalRTL } from "@/utils/rtl";

export function getContainerPositionStyle({
    columnWrapperStyle,
    contentContainerAlignItems,
    horizontal,
    hasItemSeparator,
    isHorizontalRTLList,
    numColumns,
    otherAxisPos,
    otherAxisSize,
}: {
    columnWrapperStyle: ColumnWrapperStyle | undefined;
    contentContainerAlignItems: ViewStyle["alignItems"] | undefined;
    horizontal: boolean;
    hasItemSeparator: boolean;
    isHorizontalRTLList: boolean;
    numColumns: number;
    otherAxisPos: DimensionValue | undefined;
    otherAxisSize: DimensionValue | undefined;
}): StyleProp<ViewStyle> {
    let paddingStyles: ViewStyle | undefined;
    if (columnWrapperStyle) {
        // Extract gap properties from columnWrapperStyle if available
        const { columnGap, rowGap, gap } = columnWrapperStyle;

        // Create padding styles for both horizontal and vertical layouts with multiple columns
        if (horizontal) {
            paddingStyles = {
                paddingBottom: numColumns > 1 ? (rowGap || gap || 0) / 2 : undefined,
                paddingRight: columnGap || gap || undefined,
                paddingTop: numColumns > 1 ? (rowGap || gap || 0) / 2 : undefined,
            };
        } else {
            paddingStyles = {
                paddingBottom: rowGap || gap || undefined,
                paddingLeft: numColumns > 1 ? (columnGap || gap || 0) / 2 : undefined,
                paddingRight: numColumns > 1 ? (columnGap || gap || 0) / 2 : undefined,
            };
        }
    }

    return horizontal
        ? {
              bottom: contentContainerAlignItems === "flex-end" && numColumns === 1 ? 0 : undefined,
              boxSizing: paddingStyles ? "border-box" : undefined,
              direction: isHorizontalRTLList && Platform.OS === "web" ? "ltr" : undefined,
              flexDirection: hasItemSeparator ? "row" : undefined,
              height: otherAxisSize,
              left: 0,
              position: "absolute",
              top: contentContainerAlignItems === "flex-end" && numColumns === 1 ? undefined : otherAxisPos,
              ...(paddingStyles || {}),
          }
        : {
              boxSizing: paddingStyles ? "border-box" : undefined,
              left: otherAxisPos,
              position: "absolute",
              right: numColumns > 1 ? null : 0,
              top: 0,
              width: otherAxisSize,
              ...(paddingStyles || {}),
          };
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const Container = typedMemo(function Container<ItemT>({
    id,
    itemKey,
    recycleItems,
    horizontal,
    getRenderedItem,
    ItemSeparatorComponent,
    stickyHeaderConfig,
}: {
    id: number;
    itemKey: string;
    recycleItems?: boolean;
    horizontal: boolean;
    getRenderedItem: GetRenderedItem;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
    stickyHeaderConfig?: StickyHeaderConfig;
}) {
    const ctx = useStateContext();
    const { columnWrapperStyle, animatedScrollY } = ctx;
    const isHorizontalRTLList = isHorizontalRTL(ctx.state);
    const positionComponentInternal = ctx.state.props.positionComponentInternal;
    const stickyPositionComponentInternal = ctx.state.props.stickyPositionComponentInternal;

    const [column = 0, span = 1, data, numColumns = 1, extraData, isSticky] = useArr$([
        `containerColumn${id}`,
        `containerSpan${id}`,
        `containerItemData${id}`,
        "numColumns",
        "extraData",
        `containerSticky${id}`,
    ]);

    const ref = useRef<LooseView>(null);
    const { onLayout, triggerLayout } = useContainerMeasurement({
        containerId: id,
        ctx,
        horizontal,
        itemKey,
        ref,
    });

    const resolvedColumn = column > 0 ? column : 1;
    const resolvedSpan = Math.min(Math.max(span || 1, 1), numColumns);
    const otherAxisPos: DimensionValue | undefined =
        numColumns > 1 ? `${((resolvedColumn - 1) / numColumns) * 100}%` : 0;
    const otherAxisSize: DimensionValue | undefined =
        numColumns > 1 ? `${(resolvedSpan / numColumns) * 100}%` : undefined;
    // Style is memoized because it's used as a dependency in PositionView.
    // It's unlikely to change since the position is usually the only style prop that changes.
    const style: StyleProp<ViewStyle> = useMemo(
        () =>
            getContainerPositionStyle({
                columnWrapperStyle,
                contentContainerAlignItems: ctx.state.props.contentContainerAlignItems,
                hasItemSeparator: !!ItemSeparatorComponent,
                horizontal,
                isHorizontalRTLList,
                numColumns,
                otherAxisPos,
                otherAxisSize,
            }),
        [
            horizontal,
            isHorizontalRTLList,
            otherAxisPos,
            otherAxisSize,
            columnWrapperStyle,
            ctx.state.props.contentContainerAlignItems,
            numColumns,
            ItemSeparatorComponent,
        ],
    );

    const renderedItemInfo = useMemo(
        () => (itemKey !== undefined ? getRenderedItem(itemKey, id) : null),
        [itemKey, data, extraData],
    );
    const { renderedItem } = renderedItemInfo || {};

    const contextValue = useMemo<ContextContainerType>(() => {
        ctx.viewRefs.set(id, ref);
        return {
            containerId: id,
            triggerLayout,
        };
    }, [id, triggerLayout]);

    const PositionComponent = isSticky
        ? stickyPositionComponentInternal
            ? stickyPositionComponentInternal
            : PositionViewSticky
        : positionComponentInternal
          ? positionComponentInternal
          : PositionView;

    return (
        <PositionComponent
            animatedScrollY={isSticky ? animatedScrollY : undefined}
            horizontal={horizontal}
            id={id}
            key={recycleItems ? undefined : itemKey}
            onLayout={onLayout}
            refView={ref as React.RefObject<any>}
            stickyHeaderConfig={stickyHeaderConfig}
            style={style as any}
        >
            <ContextContainer.Provider value={contextValue}>
                {renderedItem}
                {renderedItemInfo && ItemSeparatorComponent && (
                    <Separator ItemSeparatorComponent={ItemSeparatorComponent} leadingItem={renderedItemInfo.item} />
                )}
            </ContextContainer.Provider>
        </PositionComponent>
    );
});
