import * as React from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { Container } from "./Container";
import { use$ } from "./state";
import { useValue$ } from "./useValue$";

interface ContainersProps {
    horizontal: boolean;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ReactNode;
    waitForInitialLayout: boolean | undefined;
    updateItemSize: (containerId: number, itemKey: string, size: number) => void;
    getRenderedItem: (key: string) => { index: number; renderedItem: React.ReactNode } | null;
}

export const Containers = React.memo(function Containers({
    horizontal,
    recycleItems,
    ItemSeparatorComponent,
    waitForInitialLayout,
    updateItemSize,
    getRenderedItem,
}: ContainersProps) {
    const numContainers = use$<number>("numContainersPooled");
    const animSize = useValue$("totalSize");

    const containers = [];
    for (let i = 0; i < numContainers; i++) {
        containers.push(
            <Container
                id={i}
                key={i}
                recycleItems={recycleItems}
                horizontal={horizontal}
                waitForInitialLayout={waitForInitialLayout}
                getRenderedItem={getRenderedItem}
                updateItemSize={updateItemSize}
                // specifying inline separator makes Containers rerender on each data change
                // should we do memo of ItemSeparatorComponent?
                ItemSeparatorComponent={ItemSeparatorComponent}
            />,
        );
    }

    const style: StyleProp<ViewStyle> = horizontal ? { width: animSize } : { height: animSize };

    return <Animated.View style={style}>{containers}</Animated.View>;
});
