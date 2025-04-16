import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { DimensionValue, LayoutChangeEvent, StyleProp, View, ViewStyle } from "react-native";
import { Text } from "react-native";
import { ContextContainer } from "./ContextContainer";
import { LeanView } from "./LeanView";
import { ANCHORED_POSITION_OUT_OF_VIEW, ENABLE_DEVMODE } from "./constants";
import { use$, useStateContext } from "./state";
import type { AnchoredPosition } from "./types";

// @ts-expect-error nativeFabricUIManager is not defined in the global object types
const isNewArchitecture = global.nativeFabricUIManager != null;

export const Container = <ItemT,>({
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
    getRenderedItem: (key: string) => { index: number; item: ItemT; renderedItem: React.ReactNode } | null;
    updateItemSize: (itemKey: string, size: number) => void;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
}) => {
    const ctx = useStateContext();
    const columnWrapperStyle = ctx.columnWrapperStyle;
    const maintainVisibleContentPosition = use$<boolean>("maintainVisibleContentPosition");
    const position = use$<AnchoredPosition>(`containerPosition${id}`) || ANCHORED_POSITION_OUT_OF_VIEW;
    const column = use$<number>(`containerColumn${id}`) || 0;
    const numColumns = use$<number>("numColumns");
    const lastItemKeys = use$<string[]>("lastItemKeys");
    const itemKey = use$<string>(`containerItemKey${id}`);
    const data = use$<any>(`containerItemData${id}`); // to detect data changes
    const extraData = use$<string>("extraData"); // to detect extraData changes
    const refLastSize = useRef<number>();

    const otherAxisPos: DimensionValue | undefined = numColumns > 1 ? `${((column - 1) / numColumns) * 100}%` : 0;
    const otherAxisSize: DimensionValue | undefined = numColumns > 1 ? `${(1 / numColumns) * 100}%` : undefined;

    let paddingStyles: ViewStyle | undefined;
    if (columnWrapperStyle) {
        // Extract gap properties from columnWrapperStyle if available
        const { columnGap, rowGap, gap } = columnWrapperStyle;

        // Create padding styles for both horizontal and vertical layouts with multiple columns
        if (horizontal) {
            paddingStyles = {
                paddingRight: !lastItemKeys.includes(itemKey) ? columnGap || gap || undefined : undefined,
                paddingVertical: (rowGap || gap || 0) / 2,
            };
        } else {
            paddingStyles = {
                paddingBottom: !lastItemKeys.includes(itemKey) ? rowGap || gap || undefined : undefined,
                paddingHorizontal: (columnGap || gap || 0) / 2,
            };
        }
    }

    const style: StyleProp<ViewStyle> = horizontal
        ? {
              flexDirection: ItemSeparatorComponent ? "row" : undefined,
              position: "absolute",
              top: otherAxisPos,
              bottom: numColumns > 1 ? null : 0,
              height: otherAxisSize,
              left: position.relativeCoordinate,
              ...(paddingStyles || {}),
          }
        : {
              position: "absolute",
              left: otherAxisPos,
              right: numColumns > 1 ? null : 0,
              width: otherAxisSize,
              top: position.relativeCoordinate,
              ...(paddingStyles || {}),
          };

    const renderedItemInfo = useMemo(
        () => (itemKey !== undefined ? getRenderedItem(itemKey) : null),
        [itemKey, data, extraData],
    );
    const { index, renderedItem } = renderedItemInfo || {};

    const didLayout = false;

    const onLayout = (event: LayoutChangeEvent) => {
        if (itemKey !== undefined) {
            const layout = event.nativeEvent.layout;
            const size = Math.floor(layout[horizontal ? "width" : "height"] * 8) / 8; // Round to nearest quater pixel to avoid accumulating rounding errors
            refLastSize.current = size;
            updateItemSize(itemKey, size);

            // const otherAxisSize = horizontal ? event.nativeEvent.layout.width : event.nativeEvent.layout.height;
            // set$(ctx, "otherAxisSize", Math.max(otherAxisSize, peek$(ctx, "otherAxisSize") || 0));
        }
    };

    const ref = useRef<View>(null);
    if (isNewArchitecture) {
        // New architecture supports unstable_getBoundingClientRect for getting layout synchronously
        useLayoutEffect(() => {
            if (itemKey !== undefined) {
                // @ts-expect-error unstable_getBoundingClientRect is unstable and only on Fabric
                const measured = ref.current?.unstable_getBoundingClientRect?.();
                if (measured) {
                    const size = Math.floor(measured[horizontal ? "width" : "height"] * 8) / 8;

                    if (size) {
                        updateItemSize(itemKey, size);
                    }
                }
            }
        }, [itemKey]);
    } else {
        // Since old architecture cannot use unstable_getBoundingClientRect it needs to ensure that
        // all containers updateItemSize even if the container did not resize.
        useEffect(() => {
            // Catch a bug where a container is reused and is the exact same size as the previous item
            // so it does not fire an onLayout, so we need to trigger it manually.
            // TODO: There must be a better way to do this?
            if (itemKey) {
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

    const contextValue = useMemo(
        () => ({ containerId: id, itemKey, index: index!, value: data }),
        [id, itemKey, index, data],
    );

    const contentFragment = (
        <React.Fragment key={recycleItems ? undefined : itemKey}>
            <ContextContainer.Provider value={contextValue}>
                {renderedItem}
                {renderedItemInfo && ItemSeparatorComponent && !lastItemKeys.includes(itemKey) && (
                    <ItemSeparatorComponent leadingItem={renderedItemInfo.item} />
                )}
            </ContextContainer.Provider>
        </React.Fragment>
    );

    // If maintainVisibleContentPosition is enabled, we need a way items to grow upwards
    if (maintainVisibleContentPosition) {
        const anchorStyle: StyleProp<ViewStyle> =
            position.type === "top"
                ? { position: "absolute", top: 0, left: 0, right: 0 }
                : { position: "absolute", bottom: 0, left: 0, right: 0 };

        if (ENABLE_DEVMODE) {
            anchorStyle.borderColor = position.type === "top" ? "red" : "blue";
            anchorStyle.borderWidth = 1;
        }
        return (
            <LeanView style={style}>
                <LeanView style={anchorStyle} onLayout={onLayout} ref={ref}>
                    {contentFragment}
                    {ENABLE_DEVMODE && (
                        <Text style={{ position: "absolute", top: 0, left: 0, zIndex: 1000 }}>{position.top}</Text>
                    )}
                </LeanView>
            </LeanView>
        );
    }

    // Use a reactive View to ensure the container element itself
    // is not rendered when style changes, only the style prop.
    // This is a big perf boost to do less work rendering.
    return (
        <LeanView style={style} onLayout={onLayout} ref={ref}>
            {contentFragment}
        </LeanView>
    );
};
