import * as React from "react";
import type { LayoutChangeEvent, ViewStyle } from "react-native";
import { $View } from "./$View";
import { peek$, use$, useStateContext } from "./state";

interface InnerContainerProps {
    containerId: number;
    getRenderedItem: (key: string, containerId: number) => React.ReactNode;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ReactNode;
}
function InnerContainer({ containerId, getRenderedItem, recycleItems, ItemSeparatorComponent }: InnerContainerProps) {
    // Subscribe to the itemIndex so this re-renders when the itemIndex changes.
    const itemIndex = use$<number>(`containerItemIndex${containerId}`);
    const itemKey = use$<string>(`containerItemKey${containerId}`);
    const numItems = ItemSeparatorComponent ? use$<number>("numItems") : 0;

    if (itemKey === undefined) {
        return null;
    }

    return (
        <React.Fragment key={recycleItems ? undefined : itemKey}>
            <RenderedItem itemKey={itemKey} containerId={containerId} getRenderedItem={getRenderedItem} />
            {ItemSeparatorComponent && itemIndex < numItems - 1 && ItemSeparatorComponent}
        </React.Fragment>
    );
}

function RenderedItem({
    itemKey,
    containerId,
    getRenderedItem,
}: {
    itemKey: string;
    containerId: number;
    getRenderedItem: (key: string, containerId: number) => React.ReactNode;
}) {
    const renderedItem = getRenderedItem(itemKey, containerId);

    return renderedItem;
}

export const Container = ({
    id,
    recycleItems,
    horizontal,
    getRenderedItem,
    onLayout,
    ItemSeparatorComponent,
}: {
    id: number;
    recycleItems?: boolean;
    horizontal: boolean;
    getRenderedItem: (key: string, containerId: number) => React.ReactNode;
    onLayout: (key: string, size: number) => void;
    ItemSeparatorComponent?: React.ReactNode;
}) => {
    const ctx = useStateContext();

    const createStyle = (): ViewStyle => {
        const position = peek$(ctx, `containerPosition${id}`);
        return horizontal
            ? {
                  flexDirection: "row",
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: position,
                  //   opacity: 1, //position < 0 ? 0 : 1,
              }
            : {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: position,
                  //   opacity: 1, //position < 0 ? 0 : 1,
              };
    };

    // Use a reactive View to ensure the container element itself
    // is not rendered when style changes, only the style prop.
    // This is a big perf boost to do less work rendering.
    return (
        <$View
            $key={`containerPosition${id}`}
            $style={createStyle}
            onLayout={(event: LayoutChangeEvent) => {
                const key = peek$(ctx, `containerItemKey${id}`);
                if (key !== undefined) {
                    const size = event.nativeEvent.layout[horizontal ? "width" : "height"];

                    onLayout(key, size);
                }
            }}
        >
            <InnerContainer
                containerId={id}
                getRenderedItem={getRenderedItem}
                recycleItems={recycleItems!}
                ItemSeparatorComponent={ItemSeparatorComponent}
            />
        </$View>
    );
};
