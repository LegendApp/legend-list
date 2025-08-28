import { useCallback, useLayoutEffect } from "react";
import type { View } from "react-native";

import { IsNewArchitecture } from "@/constants-platform";
import type { LayoutChangeEvent, LayoutRectangle } from "@/platform/Layout";

export function useSyncLayout<T extends View>({
    ref,
    onLayoutChange,
}: {
    ref: React.RefObject<T>;
    onLayoutChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
}): { onLayout: (event: LayoutChangeEvent) => void } {
    const onLayout = useCallback(
        (event: LayoutChangeEvent) => {
            onLayoutChange(event.nativeEvent.layout, false);
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
