import * as React from "react";
import type { LayoutChangeEvent, ViewStyle } from "react-native";
import { $View } from "./$View";
import { peek$, use$, useStateContext } from "./state";

interface InnerContainerProps {
    id: number;
    getRenderedItem: (index: number, containerId: number) => React.ReactNode;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ReactNode;
}
function InnerContainer({ id, getRenderedItem, recycleItems, ItemSeparatorComponent }: InnerContainerProps) {
    // Subscribe to the itemIndex so this re-renders when the itemIndex changes.
    const itemIndex = use$<number>(`containerItemIndex${id}`);
    const numItems = ItemSeparatorComponent ? use$<number>("numItems") : 0;

    if (itemIndex < 0) {
        return null;
    }

    return (
        <React.Fragment key={recycleItems ? undefined : itemIndex}>
            <RenderedItem itemIndex={itemIndex} id={id} getRenderedItem={getRenderedItem} />
            {ItemSeparatorComponent && itemIndex < numItems - 1 && ItemSeparatorComponent}
        </React.Fragment>
    );
}

function RenderedItem({
    itemIndex,
    id,
    getRenderedItem,
}: {
    itemIndex: number;
    id: number;
    getRenderedItem: (index: number, containerId: number) => React.ReactNode;
}) {
    const renderedItem = getRenderedItem(itemIndex, id);

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
    getRenderedItem: (index: number, containerId: number) => React.ReactNode;
    onLayout: (index: number, size: number) => void;
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
                  opacity: 1, //position < 0 ? 0 : 1,
              }
            : {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: position,
                  opacity: 1, //position < 0 ? 0 : 1,
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
                const index = peek$(ctx, `containerItemIndex${id}`);
                if (index >= 0) {
                    const size = event.nativeEvent.layout[horizontal ? "width" : "height"];

                    onLayout(index, size);
                }
            }}
        >
            <InnerContainer
                id={id}
                getRenderedItem={getRenderedItem}
                recycleItems={recycleItems!}
                ItemSeparatorComponent={ItemSeparatorComponent}
            />
        </$View>
    );
};
