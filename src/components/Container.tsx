import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { View } from "react-native";

import { PositionView, PositionViewSticky } from "@/components/PositionView";
import { Separator } from "@/components/Separator";
import { IsNewArchitecture } from "@/constants-platform";
import type { LayoutRectangle } from "@/platform/Layout.native";
import { Platform } from "@/platform/Platform";
import { ContextContainer, type ContextContainerType } from "@/state/ContextContainer";
import { useArr$, useStateContext } from "@/state/state";
import { type GetRenderedItem, typedMemo } from "@/types";
import { isNullOrUndefined } from "@/utils/helpers";

export const Container = typedMemo(function Container<ItemT>({
    id,
    recycleItems,
    horizontal,
    getRenderedItem,
    updateItemSize,
    ItemSeparatorComponent,
}: {
    id: number;
    recycleItems?: boolean;
    horizontal: boolean;
    getRenderedItem: GetRenderedItem;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
}) {
    const ctx = useStateContext();
    const { columnWrapperStyle } = ctx;

    const [column = 0, data, itemKey, numColumns, extraData, isSticky] = useArr$([
        `containerColumn${id}`,
        `containerItemData${id}`,
        `containerItemKey${id}`,
        "numColumns",
        "extraData",
        `containerSticky${id}`,
    ]);

    const refLastSize = useRef<{ width: number; height: number }>();
    const ref = useRef<HTMLDivElement>(null);
    const [_, forceLayoutRender] = useState(0);

    const otherAxisPos: number | string = numColumns > 1 ? `${((column - 1) / numColumns) * 100}%` : 0;
    const otherAxisSize: string | undefined = numColumns > 1 ? `${(1 / numColumns) * 100}%` : undefined;
    let didLayout = false;

    // Style is memoized because it's used as a dependency in PositionView.
    // It's unlikely to change since the position is usually the only style prop that changes.
    const style: React.CSSProperties = useMemo(() => {
        let paddingStyles: React.CSSProperties | undefined;
        if (columnWrapperStyle) {
            // Extract gap properties from columnWrapperStyle if available
            const { columnGap, rowGap, gap } = columnWrapperStyle;

            // Create padding styles for both horizontal and vertical layouts with multiple columns
            if (horizontal) {
                const py = numColumns > 1 ? (rowGap || gap || 0) / 2 : undefined;
                paddingStyles = {
                    paddingBottom: py,
                    paddingRight: columnGap || gap || undefined,
                    paddingTop: py,
                };
            } else {
                const px = numColumns > 1 ? (columnGap || gap || 0) / 2 : undefined;
                paddingStyles = {
                    paddingBottom: rowGap || gap || undefined,
                    paddingLeft: px,
                    paddingRight: px,
                };
            }
        }

        return horizontal
            ? {
                  flexDirection: ItemSeparatorComponent ? "row" : undefined,
                  height: otherAxisSize,
                  left: 0,
                  position: "absolute",
                  top: otherAxisPos,
                  ...(paddingStyles || {}),
              }
            : {
                  left: otherAxisPos,
                  position: "absolute",
                  right: numColumns > 1 ? undefined : 0,
                  top: 0,
                  width: otherAxisSize,
                  ...(paddingStyles || {}),
              };
    }, [horizontal, otherAxisPos, otherAxisSize, columnWrapperStyle, numColumns]);

    const renderedItemInfo = useMemo(
        () => (itemKey !== undefined ? getRenderedItem(itemKey) : null),
        [itemKey, data, extraData],
    );
    const { index, renderedItem } = renderedItemInfo || {};

    const contextValue = useMemo<ContextContainerType>(() => {
        ctx.viewRefs.set(id, ref);
        return {
            containerId: id,
            index: index!,
            itemKey,
            triggerLayout: () => {
                forceLayoutRender((v) => v + 1);
            },
            value: data,
        };
    }, [id, itemKey, index, data]);

    // Note: useCallback would be pointless because it would need to have itemKey as a dependency,
    // so it'll change on every render anyway.
    const onLayoutChange = (rectangle: LayoutRectangle) => {
        if (!isNullOrUndefined(itemKey)) {
            didLayout = true;
            let layout: { width: number; height: number } = rectangle;
            const size = layout[horizontal ? "width" : "height"];

            const doUpdate = () => {
                refLastSize.current = { height: layout.height, width: layout.width };
                updateItemSize(itemKey, layout);
            };

            if (IsNewArchitecture || size > 0) {
                doUpdate();
            } else if (Platform.OS !== "web") {
                // On old architecture, the size can be 0 sometimes, maybe when not fully rendered?
                // So we need to make sure it's actually rendered and measure it to make sure it's actually 0.
                (ref.current as unknown as View)?.measure?.((_x, _y, width, height) => {
                    layout = { height, width };
                    doUpdate();
                });
            }
        }
    };

    if (!IsNewArchitecture) {
        // Since old architecture cannot use unstable_getBoundingClientRect it needs to ensure that
        // all containers updateItemSize even if the container did not resize.
        useEffect(() => {
            // Catch a bug where a container is reused and is the exact same size as the previous item
            // so it does not fire an onLayout, so we need to trigger it manually.
            // TODO: There must be a better way to do this?
            if (!isNullOrUndefined(itemKey)) {
                const timeout = setTimeout(() => {
                    if (!didLayout && refLastSize.current) {
                        updateItemSize(itemKey, refLastSize.current);
                    }
                }, 16);
                return () => {
                    clearTimeout(timeout);
                };
            }
        }, [itemKey]);
    }

    // Use animated values from state for sticky positioning

    // Use a reactive View to ensure the container element itself
    // is not rendered when style changes, only the style prop.
    // This is a big perf boost to do less work rendering.

    // Always use PositionViewAnimated for sticky containers
    const PositionComponent = isSticky ? PositionViewSticky : PositionView;

    return (
        <ContextContainer.Provider value={contextValue}>
            <PositionComponent
                horizontal={horizontal}
                id={id}
                index={index!}
                key={recycleItems ? undefined : itemKey}
                onLayoutChange={onLayoutChange}
                refView={ref}
                style={style}
            >
                {renderedItem}
                {renderedItemInfo && ItemSeparatorComponent && (
                    <Separator
                        ItemSeparatorComponent={ItemSeparatorComponent}
                        itemKey={itemKey}
                        leadingItem={renderedItemInfo.item}
                    />
                )}
            </PositionComponent>
        </ContextContainer.Provider>
    );
});
