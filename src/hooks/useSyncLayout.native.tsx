import { useCallback, useLayoutEffect } from "react";
import type { LayoutChangeEvent, View } from "react-native";

import { IsNewArchitecture } from "@/constants-platform";
import type { LayoutRectangle } from "@/platform/platform-types";

export function useSyncLayout<T extends View>({
    ref,
    onLayout: onLayoutProp,
    onLayoutChange,
}: {
    ref: React.RefObject<T>;
    onLayout: (event: LayoutChangeEvent) => void;
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
}): { onLayout: (event: LayoutChangeEvent) => void } {
    const onLayout = useCallback(
        (event: LayoutChangeEvent) => {
            onLayoutChange(event.nativeEvent.layout, false);
            onLayoutProp?.(event);
        },
        [onLayoutChange],
    );

    if (IsNewArchitecture) {
        useLayoutEffect(() => {
            if (ref.current) {
                ref.current.measure((x, y, width, height) => {
                    onLayoutChange({ height, width, x, y }, true);
                });
            }
        }, []);
    }

    return { onLayout };
}
