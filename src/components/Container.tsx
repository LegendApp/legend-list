// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DimensionValue, LayoutRectangle, StyleProp, View, ViewStyle } from "react-native";

import { PositionView, PositionViewSticky } from "@/components/PositionView";
import { Separator } from "@/components/Separator";
import { IsNewArchitecture } from "@/constants";
import { useOnLayoutSync } from "@/hooks/useOnLayoutSync";
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
    const { columnWrapperStyle, animatedScrollY } = ctx;

    const [column = 0, data, itemKey, numColumns, extraData, isSticky, stickyOffset] = useArr$([
        `containerColumn${id}`,
        `containerItemData${id}`,
        `containerItemKey${id}`,
        "numColumns",
        "extraData",
        `containerSticky${id}`,
        `containerStickyOffset${id}`,
    ]);

    const refLastSize = useRef<{ width: number; height: number }>();
    const ref = useRef<View>(null);
    const [layoutRenderCount, forceLayoutRender] = useState(0);

    const otherAxisPos: DimensionValue | undefined = numColumns > 1 ? `${((column - 1) / numColumns) * 100}%` : 0;
    const otherAxisSize: DimensionValue | undefined = numColumns > 1 ? `${(1 / numColumns) * 100}%` : undefined;
    const didLayoutRef = useRef(false);

    // Style is memoized because it's used as a dependency in PositionView.
    // It's unlikely to change since the position is usually the only style prop that changes.
    const style: StyleProp<ViewStyle> = useMemo(() => {
        let paddingStyles: ViewStyle | undefined;
        if (columnWrapperStyle) {
            // Extract gap properties from columnWrapperStyle if available
            const { columnGap, rowGap, gap } = columnWrapperStyle;

            // Create padding styles for both horizontal and vertical layouts with multiple columns
            if (horizontal) {
                paddingStyles = {
                    paddingRight: columnGap || gap || undefined,
                    paddingVertical: numColumns > 1 ? (rowGap || gap || 0) / 2 : undefined,
                };
            } else {
                paddingStyles = {
                    paddingBottom: rowGap || gap || undefined,
                    paddingHorizontal: numColumns > 1 ? (columnGap || gap || 0) / 2 : undefined,
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
                  right: numColumns > 1 ? null : 0,
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
            didLayoutRef.current = true;
            let layout: { width: number; height: number } = rectangle;

            // Apply a small rounding so we don't run callbacks for tiny changes
            const size = Math.floor(rectangle[horizontal ? "width" : "height"] * 8) / 8;

            const doUpdate = () => {
                refLastSize.current = { height: layout.height, width: layout.width };
                updateItemSize(itemKey, layout);
                didLayoutRef.current = true;
            };

            if (IsNewArchitecture || size > 0) {
                doUpdate();
            } else {
                // On old architecture, the size can be 0 sometimes, maybe when not fully rendered?
                // So we need to make sure it's actually rendered and measure it to make sure it's actually 0.
                ref.current?.measure?.((_x, _y, width, height) => {
                    layout = { height, width };
                    doUpdate();
                });
            }
        }
    };

    const { onLayout } = useOnLayoutSync(
        {
            onLayoutChange,
            ref,
        },
        [itemKey, layoutRenderCount],
    );

    if (!IsNewArchitecture) {
        // Since old architecture cannot use unstable_getBoundingClientRect it needs to ensure that
        // all containers updateItemSize even if the container did not resize.
        useEffect(() => {
            // Catch a bug where a container is reused and is the exact same size as the previous item
            // so it does not fire an onLayout, so we need to trigger it manually.
            // TODO: There must be a better way to do this?
            if (!isNullOrUndefined(itemKey)) {
                // Reset the didLayoutRef to false so that the item layout will be
                // updated even if the container is the exact same size as the previous item
                // because it would not fire an onLayout event.
                didLayoutRef.current = false;

                const timeout = setTimeout(() => {
                    if (!didLayoutRef.current && refLastSize.current) {
                        updateItemSize(itemKey, refLastSize.current);
                        didLayoutRef.current = true;
                    }
                }, 16);
                return () => {
                    clearTimeout(timeout);
                };
            }
        }, [itemKey]);
    }

    const PositionComponent = isSticky ? PositionViewSticky : PositionView;

    return (
        <PositionComponent
            animatedScrollY={isSticky ? animatedScrollY : undefined}
            horizontal={horizontal}
            id={id}
            index={index!}
            key={recycleItems ? undefined : itemKey}
            onLayout={onLayout}
            refView={ref}
            stickyOffset={isSticky ? stickyOffset : undefined}
            style={style}
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
