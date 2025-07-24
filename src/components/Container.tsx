// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DimensionValue, LayoutChangeEvent, StyleProp, View, ViewStyle } from "react-native";

import { PositionView } from "@/components/PositionView";
import { Separator } from "@/components/Separator";
import { IsNewArchitecture } from "@/constants";
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
    const columnWrapperStyle = ctx.columnWrapperStyle;

    const [column = 0, data, itemKey, numColumns, extraData] = useArr$([
        `containerColumn${id}`,
        `containerItemData${id}`,
        `containerItemKey${id}`,
        "numColumns",
        "extraData",
    ]);

    const refLastSize = useRef<{ width: number; height: number }>();
    const ref = useRef<View>(null);
    const [layoutRenderCount, forceLayoutRender] = useState(0);

    const otherAxisPos: DimensionValue | undefined = numColumns > 1 ? `${((column - 1) / numColumns) * 100}%` : 0;
    const otherAxisSize: DimensionValue | undefined = numColumns > 1 ? `${(1 / numColumns) * 100}%` : undefined;
    let didLayout = false;

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
    const onLayout = (event: LayoutChangeEvent) => {
        if (!isNullOrUndefined(itemKey)) {
            didLayout = true;
            let layout: { width: number; height: number } = event.nativeEvent.layout;
            const size = layout[horizontal ? "width" : "height"];

            const doUpdate = () => {
                refLastSize.current = { height: layout.height, width: layout.width };
                updateItemSize(itemKey, layout);
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

    if (IsNewArchitecture) {
        // New architecture supports unstable_getBoundingClientRect for getting layout synchronously
        useLayoutEffect(() => {
            if (!isNullOrUndefined(itemKey)) {
                // @ts-expect-error unstable_getBoundingClientRect is unstable and only on Fabric
                const measured = ref.current?.unstable_getBoundingClientRect?.();
                if (measured) {
                    const size = Math.floor(measured[horizontal ? "width" : "height"] * 8) / 8;

                    if (size) {
                        updateItemSize(itemKey, measured);
                    }
                }
            }
        }, [itemKey, layoutRenderCount]);
    } else {
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

    // Use a reactive View to ensure the container element itself
    // is not rendered when style changes, only the style prop.
    // This is a big perf boost to do less work rendering.
    return (
        <PositionView
            horizontal={horizontal}
            id={id}
            key={recycleItems ? undefined : itemKey}
            onLayout={onLayout}
            refView={ref}
            style={style}
        >
            <ContextContainer.Provider value={contextValue}>
                {renderedItem}
                {renderedItemInfo && ItemSeparatorComponent && (
                    <Separator
                        ItemSeparatorComponent={ItemSeparatorComponent}
                        itemKey={itemKey}
                        leadingItem={renderedItemInfo.item}
                    />
                )}
            </ContextContainer.Provider>
        </PositionView>
    );
});
