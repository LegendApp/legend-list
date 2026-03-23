// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { Animated, type ViewStyle } from "react-native";

import { Container } from "@/components/Container";
import { useValue$ } from "@/hooks/useValue$";
import { peek$, useArr$, useStateContext } from "@/state/state";
import { type GetRenderedItem, type StickyHeaderConfig, typedMemo } from "@/types";
import { debugInitialScroll, shouldDebugInitialScrollState } from "@/utils/debugInitialScroll";

interface ContainersProps<ItemT> {
    horizontal: boolean;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
    waitForInitialLayout: boolean | undefined;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    getRenderedItem: GetRenderedItem;
    stickyHeaderConfig?: StickyHeaderConfig;
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const Containers = typedMemo(function Containers<ItemT>({
    horizontal,
    recycleItems,
    ItemSeparatorComponent,
    waitForInitialLayout,
    stickyHeaderConfig,
    updateItemSize,
    getRenderedItem,
}: ContainersProps<ItemT>) {
    const ctx = useStateContext();
    const columnWrapperStyle = ctx.columnWrapperStyle;
    const [numContainers, numColumns, readyToRender] = useArr$([
        "numContainersPooled",
        "numColumns",
        "readyToRender",
    ]);
    const animSize = useValue$("totalSize", {
        // Use a microtask if increasing the size significantly, otherwise use a timeout
        // If this is the initial scroll, we don't want to delay because we want to update the size immediately
        delay: (value, prevValue) =>
            !ctx.state?.initialScroll ? (!prevValue || value - prevValue > 20 ? 0 : 200) : undefined,
    });

    const animOpacity = waitForInitialLayout
        ? useValue$("readyToRender", { getValue: (value) => (value ? 1 : 0) })
        : undefined;
    const otherAxisSize = useValue$("otherAxisSize", { delay: 0 });

    const getAnimatedValue = (value: unknown) => {
        const maybeAnimated = value as { __getValue?: () => number };
        return typeof maybeAnimated?.__getValue === "function" ? maybeAnimated.__getValue() : value;
    };

    const containers: React.ReactNode[] = [];
    for (let i = 0; i < numContainers; i++) {
        containers.push(
            <Container
                getRenderedItem={getRenderedItem}
                horizontal={horizontal}
                ItemSeparatorComponent={ItemSeparatorComponent}
                id={i}
                key={i}
                recycleItems={recycleItems}
                // specifying inline separator makes Containers rerender on each data change
                // should we do memo of ItemSeparatorComponent?
                stickyHeaderConfig={stickyHeaderConfig}
                updateItemSize={updateItemSize}
            />,
        );
    }

    const style: Animated.WithAnimatedValue<ViewStyle> = horizontal
        ? { minHeight: otherAxisSize, opacity: animOpacity, width: animSize }
        : { height: animSize, minWidth: otherAxisSize, opacity: animOpacity };

    React.useLayoutEffect(() => {
        if (!shouldDebugInitialScrollState(ctx.state)) {
            return;
        }

        const visibleKeys = [];
        for (let i = 0; i < Math.min(numContainers, 5); i++) {
            const key = peek$(ctx, `containerItemKey${i}`);
            const position = peek$(ctx, `containerPosition${i}`);
            visibleKeys.push({ i, key, position });
        }

        debugInitialScroll("containers-native", {
            animOpacity: getAnimatedValue(animOpacity),
            animSize: getAnimatedValue(animSize),
            numColumns,
            numContainers,
            readyToRender: !!readyToRender,
            sampleContainers: visibleKeys,
            totalSize: peek$(ctx, "totalSize"),
        });
    }, [ctx, numColumns, numContainers, readyToRender]);

    if (columnWrapperStyle) {
        // Extract gap properties from columnWrapperStyle if available
        const { columnGap, rowGap, gap } = columnWrapperStyle;

        const gapX = columnGap || gap || 0;
        const gapY = rowGap || gap || 0;
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

    return <Animated.View style={style}>{containers}</Animated.View>;
});
