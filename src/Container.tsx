import React, { useMemo, useRef } from "react";
import {
    type DimensionValue,
    type LayoutChangeEvent,
    Platform,
    type StyleProp,
    type View,
    type ViewStyle,
} from "react-native";
import { LeanView } from "./LeanView";
import { ANCHORED_POSITION_OUT_OF_VIEW } from "./constants";
import { listen$, peek$, use$, useStateContext } from "./state";
import type { AnchoredPosition } from "./types";

export const Container = ({
    id,
    recycleItems,
    horizontal,
    waitForInitialLayout,
    getRenderedItem,
    updateItemSize,
    ItemSeparatorComponent,
}: {
    id: number;
    recycleItems?: boolean;
    horizontal: boolean;
    waitForInitialLayout: boolean | undefined;
    getRenderedItem: (key: string, containerId: number) => React.ReactNode;
    updateItemSize: (containerId: number, itemKey: string, size: number) => void;
    ItemSeparatorComponent?: React.ReactNode;
}) => {
    const ctx = useStateContext();
    const maintainVisibleContentPosition = use$<boolean>("maintainVisibleContentPosition");
    const position = peek$<AnchoredPosition>(ctx, `containerPosition${id}`) ?? ANCHORED_POSITION_OUT_OF_VIEW;

    const column = use$<number>(`containerColumn${id}`) || 0;
    const numColumns = use$<number>("numColumns");

    const otherAxisPos: DimensionValue | undefined = numColumns > 1 ? `${((column - 1) / numColumns) * 100}%` : 0;
    const otherAxisSize: DimensionValue | undefined = numColumns > 1 ? `${(1 / numColumns) * 100}%` : undefined;

    const style: StyleProp<ViewStyle> = horizontal
        ? {
              position: "absolute",
              top: otherAxisPos,
              bottom: numColumns > 1 ? null : 0,
              height: otherAxisSize,
              left: position.relativeCoordinate,
          }
        : {
              position: "absolute",
              left: otherAxisPos,
              right: numColumns > 1 ? null : 0,
              width: otherAxisSize,
              top: position.relativeCoordinate,
          };

    if (waitForInitialLayout) {
        const visible = use$<boolean>(`containerDidLayout${id}`);
        style.opacity = visible ? 1 : 0;
    }

    const lastItemKey = use$<string>("lastItemKey");
    const itemKey = use$<string>(`containerItemKey${id}`);
    const data = use$<string>(`containerItemData${id}`); // to detect data changes
    const extraData = use$<string>("extraData"); // to detect extraData changes

    const refLastRender = useRef<{ itemKey: string; position: AnchoredPosition }>();
    refLastRender.current = { itemKey, position };
    const ref = useRef<View>(null);

    useMemo(() => {
        listen$<AnchoredPosition>(ctx, `containerPosition${id}`, (newPos) => {
            const currentItemKey = peek$(ctx, `containerItemKey${id}`);
            const cur = refLastRender.current!;
            if (Platform.OS !== "web" && currentItemKey === cur.itemKey && !horizontal) {
                ref.current?.setNativeProps({
                    style: { opacity: 1, top: newPos.relativeCoordinate },
                });
            }
        });
    }, []);

    const renderedItem = itemKey !== undefined && getRenderedItem(itemKey, id);

    const onLayout = (event: LayoutChangeEvent) => {
        const key = peek$<string>(ctx, `containerItemKey${id}`);
        if (key !== undefined) {
            // Round to nearest quater pixel to avoid accumulating rounding errors
            const size = Math.floor(event.nativeEvent.layout[horizontal ? "width" : "height"] * 8) / 8;
            updateItemSize(id, key, size);

            // const otherAxisSize = horizontal ? event.nativeEvent.layout.width : event.nativeEvent.layout.height;
            // set$(ctx, "otherAxisSize", Math.max(otherAxisSize, peek$(ctx, "otherAxisSize") || 0));
        }
    };

    const contentFragment = (
        <React.Fragment key={recycleItems ? undefined : itemKey}>
            {renderedItem}
            {renderedItem && ItemSeparatorComponent && itemKey !== lastItemKey && ItemSeparatorComponent}
        </React.Fragment>
    );

    // If maintainVisibleContentPosition is enabled, we need a way items to grow upwards
    if (maintainVisibleContentPosition) {
        const anchorStyle: StyleProp<ViewStyle> =
            position.type === "top"
                ? { position: "absolute", top: 0, left: 0, right: 0 }
                : { position: "absolute", bottom: 0, left: 0, right: 0 };
        return (
            <LeanView style={style} ref={ref}>
                <LeanView style={anchorStyle} onLayout={onLayout}>
                    {contentFragment}
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
